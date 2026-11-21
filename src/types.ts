export type UserRole = 'user' | 'cartomancer' | 'subadmin' | 'admin';

export type AdminPermission =
  | 'view_online'
  | 'view_reports'
  | 'approve_prices'
  | 'manage_consultations'
  | 'moderate_community'
  | 'manage_users';

export type ConsultationTier = 'one_question' | 'three_questions' | 'full_deck';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel?: string;
  permissions: AdminPermission[];
  avatar: string;
  bio: string;
  zodiacSign: string;
  ascendant: string;
  moonSign: string;
  interests: string[];
  whatsappUrl?: string;
  specialties?: string[];
  fullReadingPrice?: number;
  fullReadingStatus?: 'approved' | 'pending' | 'rejected';
  isLive?: boolean;
  liveTitle?: string;
  liveViewers?: number;
  rating?: number;
  totalReadings?: number;
  createdAt: string;
}

export interface PresenceLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: UserRole;
  action: 'enter' | 'exit';
  timestamp: string;
  deviceInfo: string;
}

export interface OnlineSession {
  userId: string;
  userName: string;
  userEmail: string;
  role: UserRole;
  avatar: string;
  connectedAt: string;
  activeSection: string;
}

export interface Consultation {
  id: string;
  userId: string;
  userName: string;
  cartomancerId: string;
  cartomancerName: string;
  tier: ConsultationTier;
  price: number;
  question: string;
  scheduledAt: string;
  paymentMethod: 'pix' | 'card';
  paymentStatus: 'paid' | 'pending';
  status: 'scheduled' | 'active' | 'completed';
  createdAt: string;
}

export interface DrawnCardRecord {
  id: number;
  name: string;
  numeral: string;
  upright: boolean;
  position: string;
  meaning: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  imageUrl?: string;
  audioDataUrl?: string;
  audioDurationSec?: number;
  cardsDrawn?: DrawnCardRecord[];
  createdAt: string;
}

export interface ReadingHistoryItem {
  id: string;
  userId: string;
  userName: string;
  spreadType: 'daily_1' | 'trinity_3';
  question: string;
  cards: DrawnCardRecord[];
  interpretation: string;
  createdAt: string;
}

export interface CommunityComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorRole: UserRole;
  authorSign: string;
  title: string;
  content: string;
  imageUrl?: string;
  category: string;
  likes: string[];
  comments: CommunityComment[];
  createdAt: string;
}

export interface Friendship {
  id: string;
  requesterId: string;
  recipientId: string;
  status: 'pending' | 'accepted';
  createdAt: string;
}

export interface AstroMatch {
  id: string;
  userAId: string;
  userBId: string;
  compatibilityScore: number;
  synastrySummary: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: 'booking' | 'message' | 'community' | 'match' | 'suggestion' | 'admin';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface UploadedAsset {
  id: string;
  userId: string;
  userName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
}
