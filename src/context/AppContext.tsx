import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type {
  AppNotification,
  AstroMatch,
  CommunityPost,
  Consultation,
  DrawnCardRecord,
  Friendship,
  OnlineSession,
  PublicUser,
  ReadingHistoryItem,
} from '../types';

export interface MemberDirectoryEntry {
  id: string;
  name: string;
  role: string;
  avatar: string;
  bio: string;
  zodiacSign: string;
  ascendant: string;
  moonSign: string;
  interests: string[];
}

interface ToastMessage {
  id: string;
  title: string;
  body?: string;
  kind: 'info' | 'success' | 'error';
}

interface AppContextValue {
  token: string | null;
  user: PublicUser | null;
  loading: boolean;
  cartomancers: PublicUser[];
  members: MemberDirectoryEntry[];
  communityPosts: CommunityPost[];
  onlineSessions: OnlineSession[];
  liveTables: Record<string, { cards: DrawnCardRecord[]; updatedAt: string }>;
  consultations: Consultation[];
  readingsHistory: ReadingHistoryItem[];
  friendships: Friendship[];
  matches: AstroMatch[];
  swipedIds: string[];
  notifications: AppNotification[];
  pushEnabled: boolean;
  wsConnected: boolean;
  toasts: ToastMessage[];
  activeModal: 'auth' | 'profile' | 'notifications' | null;
  setActiveModal: (modal: 'auth' | 'profile' | 'notifications' | null) => void;
  notifyToast: (title: string, body?: string, kind?: 'info' | 'success' | 'error') => void;
  dismissToast: (id: string) => void;
  setSession: (token: string, user: PublicUser) => void;
  logout: () => Promise<void>;
  refreshBootstrap: (overrideToken?: string | null) => Promise<void>;
  apiFetch: <T = unknown>(url: string, options?: RequestInit, overrideToken?: string | null) => Promise<T>;
  enablePushNotifications: () => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  sendWsSection: (section: string) => void;
  sendWsMessage: (payload: Record<string, unknown>) => void;
  subscribeWsEvent: (handler: (event: string, data: unknown) => void) => () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [cartomancers, setCartomancers] = useState<PublicUser[]>([]);
  const [members, setMembers] = useState<MemberDirectoryEntry[]>([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [onlineSessions, setOnlineSessions] = useState<OnlineSession[]>([]);
  const [liveTables, setLiveTables] = useState<Record<string, { cards: DrawnCardRecord[]; updatedAt: string }>>({});
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [readingsHistory, setReadingsHistory] = useState<ReadingHistoryItem[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [matches, setMatches] = useState<AstroMatch[]>([]);
  const [swipedIds, setSwipedIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [pushEnabled, setPushEnabled] = useState<boolean>(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );
  const [wsConnected, setWsConnected] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeModal, setActiveModal] = useState<'auth' | 'profile' | 'notifications' | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef<string | null>(null);
  const listenersRef = useRef<Set<(event: string, data: unknown) => void>>(new Set());

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notifyToast = useCallback(
    (title: string, body?: string, kind: 'info' | 'success' | 'error' = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, body, kind }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const apiFetch = useCallback(
    async <T = unknown>(url: string, options: RequestInit = {}, overrideToken?: string | null): Promise<T> => {
      const activeToken = overrideToken !== undefined ? overrideToken : tokenRef.current;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
      };
      if (activeToken) {
        headers.Authorization = `Bearer ${activeToken}`;
      }
      const res = await fetch(url, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Erro ao processar solicitação.');
      }
      return data as T;
    },
    []
  );

  const refreshBootstrap = useCallback(
    async (overrideToken?: string | null) => {
      try {
        const data = await apiFetch<{
          user: PublicUser | null;
          cartomancers: PublicUser[];
          members: MemberDirectoryEntry[];
          communityPosts: CommunityPost[];
          onlineSessions: OnlineSession[];
          liveTables: Record<string, { cards: DrawnCardRecord[]; updatedAt: string }>;
          consultations: Consultation[];
          readingsHistory: ReadingHistoryItem[];
          friendships: Friendship[];
          matches: AstroMatch[];
          swipedIds?: string[];
          notifications: AppNotification[];
        }>('/api/bootstrap', {}, overrideToken);

        setUser(data.user);
        setCartomancers(data.cartomancers);
        setMembers(data.members);
        setCommunityPosts(data.communityPosts);
        setOnlineSessions(data.onlineSessions);
        setLiveTables(data.liveTables || {});
        setConsultations(data.consultations);
        setReadingsHistory(data.readingsHistory);
        setFriendships(data.friendships);
        setMatches(data.matches);
        setSwipedIds(data.swipedIds || []);
        setNotifications(data.notifications);
      } catch (err) {
        console.error('Erro ao carregar dados iniciais:', err);
      } finally {
        setLoading(false);
      }
    },
    [apiFetch]
  );

  useEffect(() => {
    refreshBootstrap(null);
  }, [refreshBootstrap]);

  // WebSocket real-time connection
  useEffect(() => {
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = socket;

      socket.onopen = () => {
        setWsConnected(true);
        if (tokenRef.current) {
          socket.send(JSON.stringify({ type: 'auth', token: tokenRef.current }));
        }
      };

      socket.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data) as { event: string; data: unknown };
          const { event, data } = parsed;

          if (event === 'presence:update') {
            const p = data as { onlineSessions: OnlineSession[] };
            setOnlineSessions(p.onlineSessions);
          } else if (event === 'cartomancer:updated') {
            const updated = data as PublicUser;
            setCartomancers((prev) => {
              const exists = prev.some((c) => c.id === updated.id);
              if (!exists && updated.role === 'cartomancer') return [...prev, updated];
              return prev.map((c) => (c.id === updated.id ? updated : c));
            });
          } else if (event === 'community:update') {
            setCommunityPosts(data as CommunityPost[]);
          } else if (event === 'live:table') {
            const payload = data as { cartomancerId: string; cards: DrawnCardRecord[] };
            setLiveTables((prev) => ({
              ...prev,
              [payload.cartomancerId]: { cards: payload.cards, updatedAt: new Date().toISOString() },
            }));
          } else if (event === 'consultation:new') {
            const c = data as Consultation;
            setConsultations((prev) => (prev.some((x) => x.id === c.id) ? prev : [c, ...prev]));
          } else if (event === 'notification:new') {
            const n = data as AppNotification;
            setNotifications((prev) => [n, ...prev]);
            notifyToast(n.title, n.body, 'info');
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(n.title, { body: n.body });
              } catch {
                // Ignore if blocked by iframe sandbox
              }
            }
          }

          for (const handler of listenersRef.current) {
            handler(event, data);
          }
        } catch {
          // Ignore invalid socket frame
        }
      };

      socket.onclose = () => {
        setWsConnected(false);
        if (!closed) {
          reconnectTimer = setTimeout(connect, 2500);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [notifyToast]);

  const setSession = useCallback(
    (newToken: string, newUser: PublicUser) => {
      tokenRef.current = newToken;
      setToken(newToken);
      setUser(newUser);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'auth', token: newToken }));
      }
      refreshBootstrap(newToken);
    },
    [refreshBootstrap]
  );

  const logout = useCallback(async () => {
    try {
      if (tokenRef.current) {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      }
    } catch {
      // Proceed clearing local state
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'logout' }));
    }
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    setConsultations([]);
    setReadingsHistory([]);
    setFriendships([]);
    setMatches([]);
    setNotifications([]);
    notifyToast('Sessão encerrada', 'Sua saída foi registrada com segurança.', 'info');
    refreshBootstrap(null);
  }, [apiFetch, notifyToast, refreshBootstrap]);

  const enablePushNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      notifyToast('Alertas em tempo real ativos', 'As notificações continuam ativas dentro do portal.', 'info');
      return;
    }
    const perm = await Notification.requestPermission();
    setPushEnabled(perm === 'granted');
    if (perm === 'granted') {
      notifyToast('Notificações Push ativadas', 'Você receberá alertas de agendamentos, lives e matches.', 'success');
    } else {
      notifyToast('Notificações no portal ativas', 'Alertas aparecerão no painel de notificações.', 'info');
    }
  }, [notifyToast]);

  const markNotificationsRead = useCallback(async () => {
    if (!tokenRef.current) return;
    await apiFetch('/api/notifications/read', { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [apiFetch]);

  const sendWsSection = useCallback((section: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'section', section }));
    }
  }, []);

  const sendWsMessage = useCallback((payload: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const subscribeWsEvent = useCallback((handler: (event: string, data: unknown) => void) => {
    listenersRef.current.add(handler);
    return () => {
      listenersRef.current.delete(handler);
    };
  }, []);

  return (
    <AppContext.Provider
      value={{
        token,
        user,
        loading,
        cartomancers,
        members,
        communityPosts,
        onlineSessions,
        liveTables,
        consultations,
        readingsHistory,
        friendships,
        matches,
        swipedIds,
        notifications,
        pushEnabled,
        wsConnected,
        toasts,
        activeModal,
        setActiveModal,
        notifyToast,
        dismissToast,
        setSession,
        logout,
        refreshBootstrap,
        apiFetch,
        enablePushNotifications,
        markNotificationsRead,
        sendWsSection,
        sendWsMessage,
        subscribeWsEvent,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp deve ser utilizado dentro de AppProvider');
  return ctx;
}
