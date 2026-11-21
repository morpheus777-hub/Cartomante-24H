import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  AdminPermission,
  AppNotification,
  AstroMatch,
  ChatMessage,
  CommunityPost,
  Consultation,
  Friendship,
  PresenceLog,
  PublicUser,
  ReadingHistoryItem,
  UploadedAsset,
  UserRole,
} from '../src/types.ts';

export interface StoredUser extends PublicUser {
  passwordHash: string;
  salt: string;
}

export interface MatchActionRecord {
  id: string;
  fromUserId: string;
  toUserId: string;
  action: 'like' | 'pass';
  createdAt: string;
}

export interface DatabaseState {
  adminClaimed: boolean;
  users: StoredUser[];
  presenceLogs: PresenceLog[];
  consultations: Consultation[];
  chatMessages: ChatMessage[];
  readingsHistory: ReadingHistoryItem[];
  communityPosts: CommunityPost[];
  friendships: Friendship[];
  matchActions: MatchActionRecord[];
  matches: AstroMatch[];
  notifications: AppNotification[];
  uploads: UploadedAsset[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'cartomantes_db.json');

export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash: derived, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  if (!hash || !salt) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(hash, 'hex');
  if (derived.length !== storedBuffer.length) return false;
  return crypto.timingSafeEqual(derived, storedBuffer);
}

export function toPublicUser(user: StoredUser): PublicUser {
  const { passwordHash: _ph, salt: _s, ...pub } = user;
  return pub;
}

function createInitialState(): DatabaseState {
  const now = new Date().toISOString();

  const seededUsers: StoredUser[] = [
    {
      id: 'carto-selena',
      name: 'Selena Luna',
      email: 'selena.luna@cartomantes24h.com.br',
      passwordHash: '',
      salt: '',
      role: 'cartomancer',
      permissions: [],
      avatar: '/src/assets/images/reader_selena_luna_1795241298228.jpg',
      bio: 'Taróloga há 12 anos especializada em Tarot de Marselha, Baralho Cigano e aconselhamento afetivo com foco em clareza emocional.',
      zodiacSign: 'Peixes',
      ascendant: 'Libra',
      moonSign: 'Câncer',
      interests: ['Tarot', 'Baralho Cigano', 'Amor & Sinastria', 'Meditação Lunar'],
      whatsappUrl: 'https://wa.me/5511999990101?text=Ol%C3%A1%20Selena%2C%20vim%20pelo%20Cartomantes%2024h',
      specialties: ['Tarot de Marselha', 'Baralho Cigano', 'Amor & Reconciliação'],
      fullReadingPrice: 120,
      fullReadingStatus: 'approved',
      isLive: true,
      liveTitle: 'Tiragem Coletiva da Lua Crescente: Amor e Caminhos Abertos',
      liveViewers: 18,
      rating: 4.9,
      totalReadings: 1420,
      createdAt: now,
    },
    {
      id: 'carto-orion',
      name: 'Orion Sol',
      email: 'orion.sol@cartomantes24h.com.br',
      passwordHash: '',
      salt: '',
      role: 'cartomancer',
      permissions: [],
      avatar: '/src/assets/images/reader_orion_sol_1795241298267.jpg',
      bio: 'Astrólogo cármico e mestre em Arcanos Maiores. Leituras objetivas para decisões profissionais, finanças e propósito de vida.',
      zodiacSign: 'Leão',
      ascendant: 'Sagitário',
      moonSign: 'Aquário',
      interests: ['Astrologia', 'Mapa Astral', 'Tarot', 'Prosperidade'],
      whatsappUrl: 'https://wa.me/5511999990202?text=Ol%C3%A1%20Orion%2C%20quero%20agendar%20minha%20leitura',
      specialties: ['Astrologia Cármica', 'Tarot Terapêutico', 'Carreira & Finanças'],
      fullReadingPrice: 140,
      fullReadingStatus: 'approved',
      isLive: false,
      liveTitle: 'Mapa Astral & Trânsitos da Semana',
      liveViewers: 0,
      rating: 4.8,
      totalReadings: 985,
      createdAt: now,
    },
    {
      id: 'carto-maya',
      name: 'Maya Estrela',
      email: 'maya.estrela@cartomantes24h.com.br',
      passwordHash: '',
      salt: '',
      role: 'cartomancer',
      permissions: [],
      avatar: '/src/assets/images/reader_maya_estrela_1795241298251.jpg',
      bio: 'Oraculista integrativa com foco em Runas Nórdicas, Cristais e Tarot Intuitivo. Acolhimento luminoso 24h para alinhamento espiritual.',
      zodiacSign: 'Escorpião',
      ascendant: 'Touro',
      moonSign: 'Peixes',
      interests: ['Runas', 'Cristais', 'Numerologia', 'Tarot'],
      whatsappUrl: 'https://wa.me/5511999990303?text=Ol%C3%A1%20Maya%2C%20vim%20pelo%20Cartomantes%2024h',
      specialties: ['Runas Nórdicas', 'Cristaloterapia', 'Limpeza Energética'],
      fullReadingPrice: 110,
      fullReadingStatus: 'pending',
      isLive: false,
      liveTitle: 'Oráculo das Runas ao Vivo',
      liveViewers: 0,
      rating: 5.0,
      totalReadings: 1160,
      createdAt: now,
    },
    {
      id: 'member-aurora',
      name: 'Aurora Ribeiro',
      email: 'aurora.ribeiro@exemplo.com.br',
      passwordHash: '',
      salt: '',
      role: 'user',
      permissions: [],
      avatar: '/src/assets/images/tarot_deck_artwork_1795241297829.jpg',
      bio: 'Apaixonada por sinastria amorosa, cristais de quartzo rosa e leituras matinais com A Estrela.',
      zodiacSign: 'Libra',
      ascendant: 'Gêmeos',
      moonSign: 'Leão',
      interests: ['Amor & Sinastria', 'Astrologia', 'Cristais', 'Tarot'],
      createdAt: now,
    },
    {
      id: 'member-rafael',
      name: 'Rafael Costa',
      email: 'rafael.costa@exemplo.com.br',
      passwordHash: '',
      salt: '',
      role: 'user',
      permissions: [],
      avatar: '/src/assets/images/hero_celestial_sanctuary_1795241298030.jpg',
      bio: 'Estudante de astrologia e numerologia buscando amizades luminosas e conexões verdadeiras pelo mapa astral.',
      zodiacSign: 'Sagitário',
      ascendant: 'Áries',
      moonSign: 'Libra',
      interests: ['Mapa Astral', 'Numerologia', 'Meditação Lunar', 'Tarot'],
      createdAt: now,
    },
  ];

  const seededPosts: CommunityPost[] = [
    {
      id: 'post-1',
      authorId: 'carto-selena',
      authorName: 'Selena Luna',
      authorAvatar: '/src/assets/images/reader_selena_luna_1795241298228.jpg',
      authorRole: 'cartomancer',
      authorSign: 'Peixes',
      title: 'Conselho Celestial de Hoje: Arcano XVII — A Estrela',
      content:
        'A energia do dia convida à serenidade após períodos de dúvida. Acenda uma vela branca ou lavanda, mentalize sua pergunta mais sincera e observe os sinais sutis que chegam por conversas inesperadas.',
      category: 'Previsão Diária',
      likes: ['member-aurora', 'member-rafael'],
      comments: [
        {
          id: 'comment-1',
          userId: 'member-aurora',
          userName: 'Aurora Ribeiro',
          userAvatar: '/src/assets/images/tarot_deck_artwork_1795241297829.jpg',
          text: 'Minha consulta de 3 perguntas ontem com você trouxe exatamente A Estrela no futuro! Hoje já senti a resposta se manifestando.',
          createdAt: now,
        },
      ],
      createdAt: now,
    },
    {
      id: 'post-2',
      authorId: 'carto-orion',
      authorName: 'Orion Sol',
      authorAvatar: '/src/assets/images/reader_orion_sol_1795241298267.jpg',
      authorRole: 'cartomancer',
      authorSign: 'Leão',
      title: 'Alinhamento de Vênus e Mercúrio: Clareza nos Diálogos Afetivos',
      content:
        'Ótimo momento para conversas honestas em relacionamentos e parcerias profissionais. Evite suposições silenciosas e dê voz ao que seu coração deseja construir.',
      category: 'Astrologia',
      likes: ['member-rafael'],
      comments: [],
      createdAt: now,
    },
  ];

  const seededConsultations: Consultation[] = [
    {
      id: 'cons-seed-1',
      userId: 'member-aurora',
      userName: 'Aurora Ribeiro',
      cartomancerId: 'carto-selena',
      cartomancerName: 'Selena Luna',
      tier: 'three_questions',
      price: 50,
      question: 'Como está a energia do meu novo ciclo profissional e afetivo neste mês?',
      scheduledAt: now,
      paymentMethod: 'pix',
      paymentStatus: 'paid',
      status: 'completed',
      createdAt: now,
    },
  ];

  return {
    adminClaimed: false,
    users: seededUsers,
    presenceLogs: [],
    consultations: seededConsultations,
    chatMessages: [
      {
        id: 'msg-live-seed-1',
        roomId: 'live:carto-selena',
        senderId: 'carto-selena',
        senderName: 'Selena Luna',
        senderAvatar: '/src/assets/images/reader_selena_luna_1795241298228.jpg',
        text: 'Sejam bem-vindos à nossa tiragem celestial ao vivo! Enviem seu signo e sua intenção nos comentários.',
        createdAt: now,
      },
    ],
    readingsHistory: [],
    communityPosts: seededPosts,
    friendships: [],
    matchActions: [],
    matches: [],
    notifications: [],
    uploads: [],
  };
}

class Store {
  private state: DatabaseState;

  constructor() {
    this.state = this.load();
  }

  private load(): DatabaseState {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<DatabaseState>;
        const initial = createInitialState();
        return {
          ...initial,
          ...parsed,
          users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : initial.users,
          communityPosts:
            Array.isArray(parsed.communityPosts) && parsed.communityPosts.length > 0
              ? parsed.communityPosts
              : initial.communityPosts,
          uploads: Array.isArray(parsed.uploads) ? parsed.uploads : [],
        };
      }
    } catch (err) {
      console.error('Erro ao ler banco local, recriando estado inicial:', err);
    }
    const fresh = createInitialState();
    this.persist(fresh);
    return fresh;
  }

  private persist(nextState: DatabaseState) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(nextState, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  }

  public getState(): DatabaseState {
    return this.state;
  }

  public save(): void {
    this.persist(this.state);
  }

  public findUserByEmail(email: string): StoredUser | undefined {
    const normalized = email.trim().toLowerCase();
    return this.state.users.find((u) => u.email.toLowerCase() === normalized);
  }

  public findUserById(id: string): StoredUser | undefined {
    return this.state.users.find((u) => u.id === id);
  }

  public logPresence(entry: Omit<PresenceLog, 'id' | 'timestamp'>): PresenceLog {
    const log: PresenceLog = {
      ...entry,
      id: `pres-${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
    };
    this.state.presenceLogs.unshift(log);
    if (this.state.presenceLogs.length > 300) {
      this.state.presenceLogs = this.state.presenceLogs.slice(0, 300);
    }
    this.save();
    return log;
  }

  public addNotification(
    userId: string,
    type: AppNotification['type'],
    title: string,
    body: string
  ): AppNotification {
    const notif: AppNotification = {
      id: `notif-${crypto.randomUUID()}`,
      userId,
      type,
      title,
      body,
      read: false,
      createdAt: new Date().toISOString(),
    };
    this.state.notifications.unshift(notif);
    if (this.state.notifications.length > 500) {
      this.state.notifications = this.state.notifications.slice(0, 500);
    }
    this.save();
    return notif;
  }
}

export const db = new Store();

export const ALL_ADMIN_PERMISSIONS: AdminPermission[] = [
  'view_online',
  'view_reports',
  'approve_prices',
  'manage_consultations',
  'moderate_community',
  'manage_users',
];

export function hasPermission(user: PublicUser | StoredUser | undefined, perm: AdminPermission): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'subadmin') {
    return user.permissions.includes(perm);
  }
  return false;
}

export function isValidWhatsAppUrl(url: string): boolean {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'wa.me' ||
        parsed.hostname === 'api.whatsapp.com' ||
        parsed.hostname === 'www.whatsapp.com')
    );
  } catch {
    return false;
  }
}

export function isValidImagePathOrUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('/src/assets/images/')) return true;
  if (/^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(url)) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidAvatarUrl(url: string): boolean {
  if (!url) return false;
  if (isValidImagePathOrUrl(url)) return true;
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(url)) {
    return url.length <= 400_000;
  }
  return false;
}

export function isValidAudioDataUrl(url: string): boolean {
  if (!url) return false;
  if (url.length > 2_200_000) return false;
  return /^data:audio\/(webm|ogg|mp4|mpeg|wav|aac)(;codecs=[a-zA-Z0-9.,_-]+)?;base64,[A-Za-z0-9+/=]+$/.test(
    url
  );
}

export type { UserRole };
