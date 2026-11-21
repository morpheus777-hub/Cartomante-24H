import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { WebSocketServer, WebSocket } from 'ws';
import {
  ALL_ADMIN_PERMISSIONS,
  db,
  hasPermission,
  hashPassword,
  isValidAudioDataUrl,
  isValidAvatarUrl,
  isValidWhatsAppUrl,
  toPublicUser,
  verifyPassword,
} from './server/db.ts';
import type { StoredUser } from './server/db.ts';
import type {
  AdminPermission,
  ChatMessage,
  CommunityPost,
  Consultation,
  DrawnCardRecord,
  OnlineSession,
  PublicUser,
  ReadingHistoryItem,
} from './src/types.ts';
import { calculateAstrologicalCompatibility } from './src/data/zodiac.ts';

const PORT = 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

interface TokenPayload {
  uid: string;
  exp: number;
}

function signToken(uid: string): string {
  const payload: TokenPayload = {
    uid,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as TokenPayload;
    if (!payload.uid || typeof payload.exp !== 'number' || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

interface AuthedRequest extends Request {
  currentUser?: StoredUser;
}

function getBearerUser(req: Request): StoredUser | undefined {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return undefined;
  const token = authHeader.slice('Bearer '.length).trim();
  const payload = verifyToken(token);
  if (!payload) return undefined;
  return db.findUserById(payload.uid);
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = getBearerUser(req);
  if (!user) {
    res.status(401).json({ error: 'Sessão expirada ou não autenticada. Faça login para continuar.' });
    return;
  }
  req.currentUser = user;
  next();
}

function sanitizeText(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 180;
}

// Live WebSocket state & presence tracking
interface SocketClientMeta {
  ws: WebSocket;
  userId?: string;
  sessionId: string;
  activeSection: string;
  connectedAt: string;
}

const clients = new Map<WebSocket, SocketClientMeta>();
const liveTables = new Map<string, { cards: DrawnCardRecord[]; updatedAt: string }>();

function getOnlineSessions(): OnlineSession[] {
  const unique = new Map<string, OnlineSession>();
  for (const meta of clients.values()) {
    if (!meta.userId) continue;
    const u = db.findUserById(meta.userId);
    if (!u) continue;
    unique.set(u.id, {
      userId: u.id,
      userName: u.name,
      userEmail: u.email,
      role: u.role,
      avatar: u.avatar,
      connectedAt: meta.connectedAt,
      activeSection: meta.activeSection,
    });
  }
  return Array.from(unique.values());
}

function broadcastAll(event: string, data: unknown) {
  const msg = JSON.stringify({ event, data });
  for (const [ws] of clients.entries()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

function sendToUser(userId: string, event: string, data: unknown) {
  const msg = JSON.stringify({ event, data });
  for (const [ws, meta] of clients.entries()) {
    if (meta.userId === userId && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

function broadcastPresence() {
  broadcastAll('presence:update', {
    onlineSessions: getOnlineSessions(),
    onlineCount: getOnlineSessions().length,
  });
}

function canAccessRoom(user: StoredUser, roomId: string): boolean {
  if (roomId.startsWith('live:')) return true;
  if (user.role === 'admin') return true;
  const state = db.getState();

  if (roomId.startsWith('consult:')) {
    const consultId = roomId.slice('consult:'.length);
    const c = state.consultations.find((item) => item.id === consultId);
    if (!c) return false;
    return c.userId === user.id || c.cartomancerId === user.id;
  }

  if (roomId.startsWith('dm:')) {
    const parts = roomId.slice('dm:'.length).split('__');
    if (parts.length !== 2) return false;
    const [a, b] = parts;
    if (user.id !== a && user.id !== b) return false;
    return state.friendships.some(
      (f) =>
        f.status === 'accepted' &&
        ((f.requesterId === a && f.recipientId === b) || (f.requesterId === b && f.recipientId === a))
    );
  }

  if (roomId.startsWith('match:')) {
    const matchId = roomId.slice('match:'.length);
    const m = state.matches.find((item) => item.id === matchId);
    if (!m) return false;
    return m.userAId === user.id || m.userBId === user.id;
  }

  return false;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '3mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const meta: SocketClientMeta = {
      ws,
      sessionId: crypto.randomUUID(),
      activeSection: 'Início',
      connectedAt: new Date().toISOString(),
    };
    clients.set(ws, meta);

    ws.send(
      JSON.stringify({
        event: 'presence:update',
        data: {
          onlineSessions: getOnlineSessions(),
          onlineCount: getOnlineSessions().length,
        },
      })
    );

    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString()) as {
          type?: string;
          token?: string;
          section?: string;
          roomId?: string;
          targetUserId?: string;
          payload?: unknown;
        };

        if (parsed.type === 'auth' && typeof parsed.token === 'string') {
          const payload = verifyToken(parsed.token);
          if (payload) {
            const user = db.findUserById(payload.uid);
            if (user) {
              const wasAuthenticated = meta.userId === user.id;
              meta.userId = user.id;
              if (!wasAuthenticated) {
                db.logPresence({
                  userId: user.id,
                  userName: user.name,
                  userEmail: user.email,
                  role: user.role,
                  action: 'enter',
                  deviceInfo: 'Sessão Web em tempo real',
                });
              }
              broadcastPresence();
            }
          }
        } else if (parsed.type === 'logout') {
          if (meta.userId) {
            const user = db.findUserById(meta.userId);
            if (user) {
              db.logPresence({
                userId: user.id,
                userName: user.name,
                userEmail: user.email,
                role: user.role,
                action: 'exit',
                deviceInfo: 'Saída voluntária',
              });
            }
            meta.userId = undefined;
            broadcastPresence();
          }
        } else if (parsed.type === 'section' && typeof parsed.section === 'string') {
          meta.activeSection = parsed.section.slice(0, 60);
          if (meta.userId) broadcastPresence();
        } else if (
          meta.userId &&
          typeof parsed.type === 'string' &&
          parsed.type.startsWith('webrtc:') &&
          typeof parsed.roomId === 'string'
        ) {
          const sender = db.findUserById(meta.userId);
          if (sender && canAccessRoom(sender, parsed.roomId)) {
            if (parsed.targetUserId) {
              sendToUser(parsed.targetUserId, parsed.type, {
                roomId: parsed.roomId,
                fromUserId: sender.id,
                fromUserName: sender.name,
                payload: parsed.payload,
              });
            } else {
              // Broadcast join/leave to room participants
              for (const [clientWs, clientMeta] of clients.entries()) {
                if (
                  clientWs !== ws &&
                  clientMeta.userId &&
                  clientWs.readyState === WebSocket.OPEN
                ) {
                  const recipient = db.findUserById(clientMeta.userId);
                  if (recipient && canAccessRoom(recipient, parsed.roomId)) {
                    clientWs.send(
                      JSON.stringify({
                        event: parsed.type,
                        data: {
                          roomId: parsed.roomId,
                          fromUserId: sender.id,
                          fromUserName: sender.name,
                          payload: parsed.payload,
                        },
                      })
                    );
                  }
                }
              }
            }
          }
        }
      } catch {
        // Ignore malformed socket frames
      }
    });

    ws.on('close', () => {
      const prevUserId = meta.userId;
      clients.delete(ws);
      if (prevUserId) {
        const stillConnected = Array.from(clients.values()).some((c) => c.userId === prevUserId);
        if (!stillConnected) {
          const user = db.findUserById(prevUserId);
          if (user) {
            db.logPresence({
              userId: user.id,
              userName: user.name,
              userEmail: user.email,
              role: user.role,
              action: 'exit',
              deviceInfo: 'Desconexão WebSocket',
            });
          }
        }
        broadcastPresence();
      }
    });
  });

  // --- Auth Routes ---
  app.get('/api/auth/status', (_req, res) => {
    const state = db.getState();
    res.json({
      adminClaimed: state.adminClaimed,
      passcodeConfigured: Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0),
    });
  });

  app.post('/api/auth/claim-admin', (req, res) => {
    const state = db.getState();
    const configuredPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    const email = sanitizeText(req.body?.email, 180).toLowerCase();
    const name = sanitizeText(req.body?.name, 80);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';

    if (configuredPasscode) {
      if (!passcode || passcode !== configuredPasscode) {
        res.status(403).json({ error: 'Código de administrador inválido.' });
        return;
      }
    } else if (state.adminClaimed) {
      res.status(403).json({ error: 'O administrador principal já foi configurado.' });
      return;
    }

    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Informe um e-mail Gmail ou endereço válido.' });
      return;
    }
    if (name.length < 2) {
      res.status(400).json({ error: 'Informe seu nome completo.' });
      return;
    }
    if (password.length < 6 || password.length > 120) {
      res.status(400).json({ error: 'A senha deve ter entre 6 e 120 caracteres.' });
      return;
    }

    const existing = db.findUserByEmail(email);
    const { hash, salt } = hashPassword(password);

    let adminUser: StoredUser;
    if (existing) {
      existing.role = 'admin';
      existing.permissions = [...ALL_ADMIN_PERMISSIONS];
      existing.passwordHash = hash;
      existing.salt = salt;
      adminUser = existing;
    } else {
      adminUser = {
        id: `adm-${crypto.randomUUID()}`,
        name,
        email,
        passwordHash: hash,
        salt,
        role: 'admin',
        roleLabel: 'Administrador Geral',
        permissions: [...ALL_ADMIN_PERMISSIONS],
        avatar: '/src/assets/images/hero_celestial_sanctuary_1795241298030.jpg',
        bio: 'Gestão celestial e curadoria oficial do portal Cartomantes 24h.',
        zodiacSign: 'Aquário',
        ascendant: 'Leão',
        moonSign: 'Peixes',
        interests: ['Tarot', 'Astrologia', 'Mapa Astral'],
        createdAt: new Date().toISOString(),
      };
      state.users.push(adminUser);
    }

    state.adminClaimed = true;
    db.logPresence({
      userId: adminUser.id,
      userName: adminUser.name,
      userEmail: adminUser.email,
      role: adminUser.role,
      action: 'enter',
      deviceInfo: 'Acesso Administrativo',
    });
    db.save();

    const token = signToken(adminUser.id);
    res.json({ token, user: toPublicUser(adminUser) });
  });

  app.post('/api/auth/register', (req, res) => {
    const email = sanitizeText(req.body?.email, 180).toLowerCase();
    const name = sanitizeText(req.body?.name, 80);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const accountType = req.body?.accountType === 'cartomancer' ? 'cartomancer' : 'user';
    const zodiacSign = sanitizeText(req.body?.zodiacSign, 30) || 'Peixes';
    const whatsappUrl = sanitizeText(req.body?.whatsappUrl, 240);

    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Informe um endereço Gmail ou e-mail válido.' });
      return;
    }
    if (name.length < 2) {
      res.status(400).json({ error: 'Informe seu nome para o perfil celestial.' });
      return;
    }
    if (password.length < 6 || password.length > 120) {
      res.status(400).json({ error: 'A senha precisa ter no mínimo 6 caracteres.' });
      return;
    }
    if (whatsappUrl && !isValidWhatsAppUrl(whatsappUrl)) {
      res.status(400).json({ error: 'O link do WhatsApp deve começar com https://wa.me/ ou https://api.whatsapp.com/.' });
      return;
    }
    if (db.findUserByEmail(email)) {
      res.status(409).json({ error: 'Este e-mail já está cadastrado. Faça login para entrar.' });
      return;
    }

    const { hash, salt } = hashPassword(password);
    const now = new Date().toISOString();
    const newUser: StoredUser = {
      id: `${accountType === 'cartomancer' ? 'carto' : 'usr'}-${crypto.randomUUID()}`,
      name,
      email,
      passwordHash: hash,
      salt,
      role: accountType,
      permissions: [],
      avatar:
        accountType === 'cartomancer'
          ? '/src/assets/images/reader_maya_estrela_1795241298251.jpg'
          : '/src/assets/images/tarot_deck_artwork_1795241297829.jpg',
      bio:
        accountType === 'cartomancer'
          ? 'Cartomante disponível 24h para leituras personalizadas com acolhimento e clareza.'
          : 'Explorando caminhos espirituais, leituras de tarot e conexões astrais no Cartomantes 24h.',
      zodiacSign,
      ascendant: 'Libra',
      moonSign: 'Lua em Touro',
      interests: ['Tarot', 'Astrologia', 'Amor & Sinastria'],
      ...(accountType === 'cartomancer'
        ? {
            whatsappUrl: whatsappUrl || 'https://wa.me/5511999990000',
            specialties: ['Tarot Intuitivo', 'Conselhos Amorosos'],
            fullReadingPrice: 95,
            fullReadingStatus: 'pending' as const,
            isLive: false,
            liveTitle: 'Tiragem Intuitiva ao Vivo',
            liveViewers: 0,
            rating: 5.0,
            totalReadings: 1,
          }
        : {}),
      createdAt: now,
    };

    const state = db.getState();
    state.users.push(newUser);
    db.logPresence({
      userId: newUser.id,
      userName: newUser.name,
      userEmail: newUser.email,
      role: newUser.role,
      action: 'enter',
      deviceInfo: 'Cadastro e Entrada',
    });
    db.addNotification(
      newUser.id,
      'suggestion',
      'Boas-vindas ao Cartomantes 24h',
      'Sua energia de hoje favorece uma tiragem de 1 carta no Oráculo Diário e conexões no Match Astral.'
    );
    db.save();

    const token = signToken(newUser.id);
    res.status(201).json({ token, user: toPublicUser(newUser) });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = sanitizeText(req.body?.email, 180).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!isValidEmail(email) || !password) {
      res.status(400).json({ error: 'Informe e-mail e senha válidos.' });
      return;
    }

    const user = db.findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
      res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      return;
    }

    db.logPresence({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      role: user.role,
      action: 'enter',
      deviceInfo: 'Login autenticado',
    });
    db.save();

    const token = signToken(user.id);
    res.json({ token, user: toPublicUser(user) });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    db.logPresence({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      role: user.role,
      action: 'exit',
      deviceInfo: 'Saída da conta',
    });
    db.save();
    res.json({ ok: true });
  });

  // --- Bootstrap Data ---
  app.get('/api/bootstrap', (req, res) => {
    const currentUser = getBearerUser(req);
    const state = db.getState();
    const cartomancers = state.users
      .filter((u) => u.role === 'cartomancer')
      .map(toPublicUser);

    const members = state.users
      .filter((u) => u.role === 'user' || u.role === 'cartomancer')
      .map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
        avatar: u.avatar,
        bio: u.bio,
        zodiacSign: u.zodiacSign,
        ascendant: u.ascendant,
        moonSign: u.moonSign,
        interests: u.interests,
      }));

    if (!currentUser) {
      res.json({
        user: null,
        cartomancers,
        members,
        communityPosts: state.communityPosts,
        onlineSessions: getOnlineSessions(),
        liveTables: Object.fromEntries(liveTables.entries()),
        consultations: [],
        readingsHistory: [],
        friendships: [],
        matches: [],
        notifications: [],
      });
      return;
    }

    const myConsultations = state.consultations.filter(
      (c) => c.userId === currentUser.id || c.cartomancerId === currentUser.id || currentUser.role === 'admin'
    );
    const myReadings = state.readingsHistory.filter((r) => r.userId === currentUser.id);
    const myFriendships = state.friendships.filter(
      (f) => f.requesterId === currentUser.id || f.recipientId === currentUser.id
    );
    const myMatches = state.matches.filter(
      (m) => m.userAId === currentUser.id || m.userBId === currentUser.id
    );
    const myNotifs = state.notifications.filter((n) => n.userId === currentUser.id);
    const mySwipedIds = state.matchActions
      .filter((a) => a.fromUserId === currentUser.id)
      .map((a) => a.toUserId);

    res.json({
      user: toPublicUser(currentUser),
      cartomancers,
      members,
      communityPosts: state.communityPosts,
      onlineSessions: getOnlineSessions(),
      liveTables: Object.fromEntries(liveTables.entries()),
      consultations: myConsultations,
      readingsHistory: myReadings,
      friendships: myFriendships,
      matches: myMatches,
      swipedIds: mySwipedIds,
      notifications: myNotifs,
    });
  });

  // --- Profile Update ---
  app.patch('/api/profile', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const name = sanitizeText(req.body?.name, 80);
    const bio = sanitizeText(req.body?.bio, 420);
    const avatar = typeof req.body?.avatar === 'string' ? req.body.avatar.trim() : '';
    const zodiacSign = sanitizeText(req.body?.zodiacSign, 30);
    const ascendant = sanitizeText(req.body?.ascendant, 30);
    const moonSign = sanitizeText(req.body?.moonSign, 30);
    const interestsRaw = Array.isArray(req.body?.interests) ? req.body.interests : undefined;

    if (name && name.length >= 2) user.name = name;
    if (typeof req.body?.bio === 'string') user.bio = bio;
    if (avatar) {
      if (!isValidAvatarUrl(avatar)) {
        res.status(400).json({ error: 'Formato de foto de perfil inválido ou muito grande.' });
        return;
      }
      user.avatar = avatar;
    }
    if (zodiacSign) user.zodiacSign = zodiacSign;
    if (ascendant) user.ascendant = ascendant;
    if (moonSign) user.moonSign = moonSign;
    if (interestsRaw) {
      user.interests = (interestsRaw as unknown[])
        .filter((item: unknown): item is string => typeof item === 'string')
        .map((item: string) => item.trim().slice(0, 40))
        .slice(0, 8);
    }

    if (user.role === 'cartomancer') {
      if (typeof req.body?.whatsappUrl === 'string') {
        const wa = req.body.whatsappUrl.trim();
        if (!isValidWhatsAppUrl(wa)) {
          res.status(400).json({ error: 'Link WhatsApp inválido. Use https://wa.me/seu-numero.' });
          return;
        }
        user.whatsappUrl = wa;
      }
      if (Array.isArray(req.body?.specialties)) {
        user.specialties = (req.body.specialties as unknown[])
          .filter((s: unknown): s is string => typeof s === 'string')
          .map((s: string) => s.trim().slice(0, 40))
          .slice(0, 5);
      }
      if (typeof req.body?.fullReadingPrice === 'number' && Number.isFinite(req.body.fullReadingPrice)) {
        const clamped = Math.round(Math.max(60, Math.min(2000, req.body.fullReadingPrice)));
        if (clamped !== user.fullReadingPrice) {
          user.fullReadingPrice = clamped;
          user.fullReadingStatus = 'pending';
        }
      }
    }

    db.save();
    broadcastAll('cartomancer:updated', toPublicUser(user));
    res.json({ user: toPublicUser(user) });
  });

  // --- Cartomancer Live Controls (Strictly Cartomancer Only) ---
  app.post('/api/cartomancer/live', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (user.role !== 'cartomancer') {
      res.status(403).json({
        error: 'Acesso exclusivo de cartomante: somente a própria cartomante pode abrir sua live de vídeo e microfone.',
      });
      return;
    }

    const carto = db.findUserById(user.id);
    if (!carto || carto.role !== 'cartomancer') {
      res.status(404).json({ error: 'Cartomante não encontrado.' });
      return;
    }

    const isLive = Boolean(req.body?.isLive);
    const liveTitle = sanitizeText(req.body?.liveTitle, 120);
    carto.isLive = isLive;
    if (liveTitle) carto.liveTitle = liveTitle;
    carto.liveViewers = isLive ? Math.max(1, carto.liveViewers || 1) : 0;

    if (Array.isArray(req.body?.drawnCards)) {
      const cards = (req.body.drawnCards as DrawnCardRecord[]).slice(0, 3);
      liveTables.set(carto.id, { cards, updatedAt: new Date().toISOString() });
      broadcastAll('live:table', { cartomancerId: carto.id, cards });
    }

    db.save();
    broadcastAll('cartomancer:updated', toPublicUser(carto));
    res.json({ cartomancer: toPublicUser(carto) });
  });

  // --- Consultations & Payment ---
  app.post('/api/consultations', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const cartomancerId = sanitizeText(req.body?.cartomancerId, 80);
    const tier = req.body?.tier;
    const question = sanitizeText(req.body?.question, 500);
    const scheduledAt = sanitizeText(req.body?.scheduledAt, 60) || new Date().toISOString();
    const paymentMethod = req.body?.paymentMethod === 'card' ? 'card' : 'pix';

    const carto = db.findUserById(cartomancerId);
    if (!carto || carto.role !== 'cartomancer') {
      res.status(404).json({ error: 'Cartomante não localizado.' });
      return;
    }

    let price = 15;
    if (tier === 'one_question') {
      price = 15;
    } else if (tier === 'three_questions') {
      price = 50;
    } else if (tier === 'full_deck') {
      if (carto.fullReadingStatus !== 'approved' || !carto.fullReadingPrice) {
        res.status(400).json({ error: 'O valor do Jogo Completo ainda aguarda aprovação administrativa.' });
        return;
      }
      price = carto.fullReadingPrice;
    } else {
      res.status(400).json({ error: 'Modalidade de consulta inválida.' });
      return;
    }

    if (question.length < 4) {
      res.status(400).json({ error: 'Escreva sua pergunta ou intenção para a consulta.' });
      return;
    }

    const consultation: Consultation = {
      id: `cons-${crypto.randomUUID()}`,
      userId: user.id,
      userName: user.name,
      cartomancerId: carto.id,
      cartomancerName: carto.name,
      tier,
      price,
      question,
      scheduledAt,
      paymentMethod,
      paymentStatus: 'paid',
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const state = db.getState();
    state.consultations.unshift(consultation);
    carto.totalReadings = (carto.totalReadings || 0) + 1;

    // Welcome message in the consultation room
    const welcomeMsg: ChatMessage = {
      id: `msg-${crypto.randomUUID()}`,
      roomId: `consult:${consultation.id}`,
      senderId: carto.id,
      senderName: carto.name,
      senderAvatar: carto.avatar,
      text: `Olá ${user.name}! Pagamento confirmado e acesso liberado. Recebi sua pergunta ("${question}") e estou preparando as cartas para nosso atendimento.`,
      createdAt: new Date().toISOString(),
    };
    state.chatMessages.push(welcomeMsg);

    const notifUser = db.addNotification(
      user.id,
      'booking',
      'Agendamento Confirmado',
      `Sua consulta com ${carto.name} (R$ ${price.toFixed(2).replace('.', ',')}) foi confirmada e o chat em tempo real está liberado.`
    );
    const notifCarto = db.addNotification(
      carto.id,
      'booking',
      'Nova Consulta Agendada',
      `${user.name} agendou ${tier === 'one_question' ? '1 Pergunta' : tier === 'three_questions' ? '3 Perguntas' : 'Jogo Completo'} (R$ ${price.toFixed(2).replace('.', ',')}).`
    );

    db.save();
    sendToUser(user.id, 'notification:new', notifUser);
    sendToUser(carto.id, 'notification:new', notifCarto);
    sendToUser(carto.id, 'consultation:new', consultation);

    res.status(201).json({ consultation });
  });

  // --- Real-Time Chat (Consultations, Live Stream, Friends, Astro Match) ---
  app.get('/api/chat/:roomId', requireAuth, (req: AuthedRequest, res) => {
    const roomId = String(req.params.roomId || '');
    if (!canAccessRoom(req.currentUser!, roomId)) {
      res.status(403).json({ error: 'Você não tem permissão para acessar esta sala de conversa.' });
      return;
    }
    const messages = db.getState().chatMessages.filter((m) => m.roomId === roomId).slice(-100);
    res.json({ messages });
  });

  app.post('/api/chat/:roomId', requireAuth, (req: AuthedRequest, res) => {
    const roomId = String(req.params.roomId || '');
    const user = req.currentUser!;
    if (!canAccessRoom(user, roomId)) {
      res.status(403).json({ error: 'Você não tem permissão para enviar mensagens nesta sala.' });
      return;
    }

    const text = sanitizeText(req.body?.text, 800);
    const rawAudio = typeof req.body?.audioDataUrl === 'string' ? req.body.audioDataUrl.trim() : '';
    const audioDurationSec =
      typeof req.body?.audioDurationSec === 'number' && Number.isFinite(req.body.audioDurationSec)
        ? Math.max(1, Math.min(300, Math.round(req.body.audioDurationSec)))
        : undefined;
    const cardsDrawn = Array.isArray(req.body?.cardsDrawn)
      ? (req.body.cardsDrawn as DrawnCardRecord[]).slice(0, 3)
      : undefined;

    if (rawAudio && !isValidAudioDataUrl(rawAudio)) {
      res.status(400).json({ error: 'Formato de áudio inválido ou arquivo acima do limite.' });
      return;
    }

    if (!text && !rawAudio && (!cardsDrawn || cardsDrawn.length === 0)) {
      res.status(400).json({ error: 'Digite uma mensagem ou grave um áudio para enviar.' });
      return;
    }

    const message: ChatMessage = {
      id: `msg-${crypto.randomUUID()}`,
      roomId,
      senderId: user.id,
      senderName: user.name,
      senderAvatar: user.avatar,
      text: text || (rawAudio ? 'Mensagem de voz' : ''),
      ...(rawAudio ? { audioDataUrl: rawAudio, audioDurationSec } : {}),
      ...(cardsDrawn ? { cardsDrawn } : {}),
      createdAt: new Date().toISOString(),
    };

    const state = db.getState();
    state.chatMessages.push(message);
    if (state.chatMessages.length > 2000) {
      state.chatMessages = state.chatMessages.slice(-2000);
    }
    db.save();

    if (roomId.startsWith('live:')) {
      broadcastAll('chat:message', message);
    } else if (roomId.startsWith('consult:')) {
      const consultId = roomId.slice('consult:'.length);
      const c = state.consultations.find((item) => item.id === consultId);
      if (c) {
        sendToUser(c.userId, 'chat:message', message);
        sendToUser(c.cartomancerId, 'chat:message', message);
      }
    } else if (roomId.startsWith('dm:')) {
      const [a, b] = roomId.slice('dm:'.length).split('__');
      sendToUser(a, 'chat:message', message);
      sendToUser(b, 'chat:message', message);
    } else if (roomId.startsWith('match:')) {
      const matchId = roomId.slice('match:'.length);
      const m = state.matches.find((item) => item.id === matchId);
      if (m) {
        sendToUser(m.userAId, 'chat:message', message);
        sendToUser(m.userBId, 'chat:message', message);
      }
    }

    res.status(201).json({ message });
  });

  // --- Tarot Reading History ---
  app.get('/api/readings', requireAuth, (req: AuthedRequest, res) => {
    const items = db.getState().readingsHistory.filter((r) => r.userId === req.currentUser!.id);
    res.json({ readings: items });
  });

  app.post('/api/readings', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const spreadType = req.body?.spreadType === 'trinity_3' ? 'trinity_3' : 'daily_1';
    const question = sanitizeText(req.body?.question, 300) || 'Orientação espiritual do dia';
    const interpretation = sanitizeText(req.body?.interpretation, 1600);
    const cards = Array.isArray(req.body?.cards) ? (req.body.cards as DrawnCardRecord[]).slice(0, 3) : [];

    if (cards.length === 0) {
      res.status(400).json({ error: 'Selecione ou sorteie ao menos uma carta para salvar.' });
      return;
    }

    const record: ReadingHistoryItem = {
      id: `read-${crypto.randomUUID()}`,
      userId: user.id,
      userName: user.name,
      spreadType,
      question,
      cards,
      interpretation,
      createdAt: new Date().toISOString(),
    };

    db.getState().readingsHistory.unshift(record);
    db.save();
    res.status(201).json({ reading: record });
  });

  // --- Community Posts, Likes & Comments ---
  app.post('/api/community/posts', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const title = sanitizeText(req.body?.title, 140);
    const content = sanitizeText(req.body?.content, 1200);
    const category = sanitizeText(req.body?.category, 40) || 'Experiência';

    if (title.length < 3 || content.length < 6) {
      res.status(400).json({ error: 'Preencha título e conteúdo da publicação.' });
      return;
    }

    const post: CommunityPost = {
      id: `post-${crypto.randomUUID()}`,
      authorId: user.id,
      authorName: user.name,
      authorAvatar: user.avatar,
      authorRole: user.role,
      authorSign: user.zodiacSign,
      title,
      content,
      category,
      likes: [],
      comments: [],
      createdAt: new Date().toISOString(),
    };

    const state = db.getState();
    state.communityPosts.unshift(post);

    // Notify connected members when a cartomancer shares daily mystical content
    if (user.role === 'cartomancer') {
      for (const u of state.users) {
        if (u.id !== user.id && u.role === 'user') {
          const n = db.addNotification(
            u.id,
            'community',
            `Novo conteúdo de ${user.name}`,
            title
          );
          sendToUser(u.id, 'notification:new', n);
        }
      }
    }

    db.save();
    broadcastAll('community:update', state.communityPosts);
    res.status(201).json({ post });
  });

  app.post('/api/community/posts/:id/like', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const state = db.getState();
    const post = state.communityPosts.find((p) => p.id === req.params.id);
    if (!post) {
      res.status(404).json({ error: 'Publicação não encontrada.' });
      return;
    }

    const idx = post.likes.indexOf(user.id);
    if (idx >= 0) {
      post.likes.splice(idx, 1);
    } else {
      post.likes.push(user.id);
    }

    db.save();
    broadcastAll('community:update', state.communityPosts);
    res.json({ post });
  });

  app.post('/api/community/posts/:id/comments', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const text = sanitizeText(req.body?.text, 500);
    if (text.length < 2) {
      res.status(400).json({ error: 'Escreva um comentário antes de enviar.' });
      return;
    }
    const state = db.getState();
    const post = state.communityPosts.find((p) => p.id === req.params.id);
    if (!post) {
      res.status(404).json({ error: 'Publicação não encontrada.' });
      return;
    }

    post.comments.push({
      id: `cmt-${crypto.randomUUID()}`,
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      text,
      createdAt: new Date().toISOString(),
    });

    db.save();
    broadcastAll('community:update', state.communityPosts);
    res.status(201).json({ post });
  });

  app.delete('/api/community/posts/:id', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const state = db.getState();
    const idx = state.communityPosts.findIndex((p) => p.id === req.params.id);
    if (idx < 0) {
      res.status(404).json({ error: 'Publicação não encontrada.' });
      return;
    }
    const post = state.communityPosts[idx];
    if (post.authorId !== user.id && !hasPermission(user, 'moderate_community')) {
      res.status(403).json({ error: 'Sem permissão para remover esta publicação.' });
      return;
    }
    state.communityPosts.splice(idx, 1);
    db.save();
    broadcastAll('community:update', state.communityPosts);
    res.json({ ok: true });
  });

  // --- Friendships ---
  app.post('/api/friends/request', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const recipientId = sanitizeText(req.body?.recipientId, 80);
    if (!recipientId || recipientId === user.id) {
      res.status(400).json({ error: 'Membro inválido.' });
      return;
    }
    const target = db.findUserById(recipientId);
    if (!target) {
      res.status(404).json({ error: 'Membro não encontrado.' });
      return;
    }

    const state = db.getState();
    const existing = state.friendships.find(
      (f) =>
        (f.requesterId === user.id && f.recipientId === recipientId) ||
        (f.requesterId === recipientId && f.recipientId === user.id)
    );
    if (existing) {
      res.json({ friendship: existing });
      return;
    }

    const friendship = {
      id: `fr-${crypto.randomUUID()}`,
      requesterId: user.id,
      recipientId,
      status: 'accepted' as const,
      createdAt: new Date().toISOString(),
    };
    state.friendships.push(friendship);
    const notif = db.addNotification(
      recipientId,
      'message',
      'Nova amizade celestial',
      `${user.name} (${user.zodiacSign}) conectou-se com você para chat privado.`
    );
    db.save();

    sendToUser(recipientId, 'notification:new', notif);
    sendToUser(recipientId, 'friendship:new', friendship);
    res.status(201).json({ friendship });
  });

  // --- Astrological Match & Dating Chat ---
  app.post('/api/matches/action', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const targetId = sanitizeText(req.body?.targetId, 80);
    const action = req.body?.action === 'pass' ? 'pass' : 'like';
    const target = db.findUserById(targetId);

    if (!target || target.id === user.id) {
      res.status(404).json({ error: 'Perfil astral não encontrado.' });
      return;
    }

    const state = db.getState();
    const already = state.matchActions.find(
      (a) => a.fromUserId === user.id && a.toUserId === targetId
    );
    if (!already) {
      state.matchActions.push({
        id: `ma-${crypto.randomUUID()}`,
        fromUserId: user.id,
        toUserId: targetId,
        action,
        createdAt: new Date().toISOString(),
      });
    } else {
      already.action = action;
    }

    let createdMatch = null;
    if (action === 'like') {
      const { score, summary } = calculateAstrologicalCompatibility(
        user.zodiacSign,
        user.interests,
        target.zodiacSign,
        target.interests
      );

      // Mutual match occurs if target liked user OR high astrological synastry (>= 84% for seeded profiles with no passwordHash)
      const reciprocal = state.matchActions.find(
        (a) => a.fromUserId === targetId && a.toUserId === user.id && a.action === 'like'
      );
      const isSeededProfile = target.passwordHash === '' && score >= 84;

      if (reciprocal || isSeededProfile) {
        const existingMatch = state.matches.find(
          (m) =>
            (m.userAId === user.id && m.userBId === targetId) ||
            (m.userAId === targetId && m.userBId === user.id)
        );
        if (!existingMatch) {
          createdMatch = {
            id: `match-${crypto.randomUUID()}`,
            userAId: user.id,
            userBId: targetId,
            compatibilityScore: score,
            synastrySummary: summary,
            createdAt: new Date().toISOString(),
          };
          state.matches.unshift(createdMatch);
          const n1 = db.addNotification(
            user.id,
            'match',
            `Match Astral com ${target.name} (${score}%)`,
            `${summary} O chat de encontro já está liberado.`
          );
          const n2 = db.addNotification(
            targetId,
            'match',
            `Novo Match Astral com ${user.name} (${score}%)`,
            summary
          );
          sendToUser(user.id, 'notification:new', n1);
          sendToUser(targetId, 'notification:new', n2);
        } else {
          createdMatch = existingMatch;
        }
      }
    }

    db.save();
    res.json({ match: createdMatch });
  });

  // --- Notifications ---
  app.patch('/api/notifications/read', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    const state = db.getState();
    for (const n of state.notifications) {
      if (n.userId === user.id) n.read = true;
    }
    db.save();
    res.json({ ok: true });
  });

  // --- Admin & Subaccounts Console ---
  app.get('/api/admin/overview', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (user.role !== 'admin' && user.role !== 'subadmin') {
      res.status(403).json({ error: 'Acesso restrito à administração e subcontas autorizadas.' });
      return;
    }

    const state = db.getState();
    const totalRevenue = state.consultations
      .filter((c) => c.paymentStatus === 'paid')
      .reduce((acc, c) => acc + c.price, 0);

    const cartomancers = state.users
      .filter((u) => u.role === 'cartomancer')
      .map(toPublicUser);

    const subaccounts =
      user.role === 'admin' || hasPermission(user, 'manage_users')
        ? state.users.filter((u) => u.role === 'subadmin').map(toPublicUser)
        : [];

    res.json({
      onlineSessions: hasPermission(user, 'view_online') ? getOnlineSessions() : [],
      presenceLogs: hasPermission(user, 'view_online') ? state.presenceLogs.slice(0, 120) : [],
      consultations: hasPermission(user, 'manage_consultations') || hasPermission(user, 'view_reports')
        ? state.consultations
        : [],
      totalRevenue,
      cartomancers,
      subaccounts,
    });
  });

  app.post('/api/admin/price-approval', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (!hasPermission(user, 'approve_prices')) {
      res.status(403).json({ error: 'Sem permissão para aprovar valores.' });
      return;
    }

    const cartomancerId = sanitizeText(req.body?.cartomancerId, 80);
    const status = req.body?.status === 'approved' ? 'approved' : 'rejected';
    const carto = db.findUserById(cartomancerId);
    if (!carto || carto.role !== 'cartomancer') {
      res.status(404).json({ error: 'Cartomante não encontrado.' });
      return;
    }

    carto.fullReadingStatus = status;
    const n = db.addNotification(
      carto.id,
      'admin',
      status === 'approved' ? 'Valor do Jogo Completo Aprovado' : 'Revisão de Valor Solicitada',
      status === 'approved'
        ? `Seu valor de R$ ${(carto.fullReadingPrice || 0).toFixed(2).replace('.', ',')} já está ativo para agendamentos.`
        : 'Ajuste o valor proposto no seu perfil para nova validação.'
    );
    db.save();
    sendToUser(carto.id, 'notification:new', n);
    broadcastAll('cartomancer:updated', toPublicUser(carto));
    res.json({ cartomancer: toPublicUser(carto) });
  });

  app.patch('/api/admin/cartomancer/:id', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (!hasPermission(user, 'manage_consultations') && !hasPermission(user, 'manage_users')) {
      res.status(403).json({ error: 'Sem permissão para editar cartomantes.' });
      return;
    }
    const carto = db.findUserById(String(req.params.id));
    if (!carto || carto.role !== 'cartomancer') {
      res.status(404).json({ error: 'Cartomante não encontrado.' });
      return;
    }

    if (typeof req.body?.bio === 'string') carto.bio = sanitizeText(req.body.bio, 420);
    if (typeof req.body?.isLive === 'boolean') carto.isLive = req.body.isLive;
    if (typeof req.body?.whatsappUrl === 'string' && isValidWhatsAppUrl(req.body.whatsappUrl)) {
      carto.whatsappUrl = req.body.whatsappUrl.trim();
    }
    if (typeof req.body?.fullReadingPrice === 'number' && Number.isFinite(req.body.fullReadingPrice)) {
      carto.fullReadingPrice = Math.round(Math.max(60, Math.min(2000, req.body.fullReadingPrice)));
      carto.fullReadingStatus = 'approved';
    }

    db.save();
    broadcastAll('cartomancer:updated', toPublicUser(carto));
    res.json({ cartomancer: toPublicUser(carto) });
  });

  app.post('/api/admin/subaccounts', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (user.role !== 'admin' && !hasPermission(user, 'manage_users')) {
      res.status(403).json({ error: 'Apenas administradores autorizados podem criar subcontas.' });
      return;
    }

    const name = sanitizeText(req.body?.name, 80);
    const email = sanitizeText(req.body?.email, 180).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const roleLabel = sanitizeText(req.body?.roleLabel, 60) || 'Operador da Equipe';
    const permissionsRaw = Array.isArray(req.body?.permissions) ? (req.body.permissions as unknown[]) : [];
    const permissions = permissionsRaw.filter((p: unknown): p is AdminPermission =>
      ALL_ADMIN_PERMISSIONS.includes(p as AdminPermission)
    );

    if (name.length < 2 || !isValidEmail(email) || password.length < 6) {
      res.status(400).json({ error: 'Preencha nome, e-mail válido e senha com no mínimo 6 caracteres.' });
      return;
    }
    if (db.findUserByEmail(email)) {
      res.status(409).json({ error: 'Já existe uma conta cadastrada com este e-mail.' });
      return;
    }

    const { hash, salt } = hashPassword(password);
    const subaccount: StoredUser = {
      id: `sub-${crypto.randomUUID()}`,
      name,
      email,
      passwordHash: hash,
      salt,
      role: 'subadmin',
      roleLabel,
      permissions,
      avatar: '/src/assets/images/hero_celestial_sanctuary_1795241298030.jpg',
      bio: `Subconta administrativa · ${roleLabel}`,
      zodiacSign: 'Libra',
      ascendant: 'Virgem',
      moonSign: 'Touro',
      interests: ['Tarot', 'Astrologia'],
      createdAt: new Date().toISOString(),
    };

    db.getState().users.push(subaccount);
    db.save();
    res.status(201).json({ subaccount: toPublicUser(subaccount) });
  });

  app.patch('/api/admin/subaccounts/:id', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (user.role !== 'admin' && !hasPermission(user, 'manage_users')) {
      res.status(403).json({ error: 'Sem permissão para editar subcontas.' });
      return;
    }

    const sub = db.findUserById(String(req.params.id));
    if (!sub || sub.role !== 'subadmin') {
      res.status(404).json({ error: 'Subconta não encontrada.' });
      return;
    }

    if (Array.isArray(req.body?.permissions)) {
      sub.permissions = req.body.permissions.filter((p: unknown): p is AdminPermission =>
        ALL_ADMIN_PERMISSIONS.includes(p as AdminPermission)
      );
    }
    if (typeof req.body?.roleLabel === 'string') {
      sub.roleLabel = sanitizeText(req.body.roleLabel, 60) || sub.roleLabel;
    }
    db.save();
    res.json({ subaccount: toPublicUser(sub) });
  });

  app.delete('/api/admin/subaccounts/:id', requireAuth, (req: AuthedRequest, res) => {
    const user = req.currentUser!;
    if (user.role !== 'admin' && !hasPermission(user, 'manage_users')) {
      res.status(403).json({ error: 'Sem permissão para remover subcontas.' });
      return;
    }

    const state = db.getState();
    const idx = state.users.findIndex((u) => u.id === req.params.id && u.role === 'subadmin');
    if (idx < 0) {
      res.status(404).json({ error: 'Subconta não encontrada.' });
      return;
    }
    state.users.splice(idx, 1);
    db.save();
    res.json({ ok: true });
  });

  // Vite / Static serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build não encontrado.');
      }
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Cartomantes 24h ativo em http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar servidor Cartomantes 24h:', err);
  process.exit(1);
});
