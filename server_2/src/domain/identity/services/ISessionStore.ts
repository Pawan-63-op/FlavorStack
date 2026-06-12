export interface SessionData {
  userId: string;
  sessionId: string;
  refreshTokenHash: string;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface ISessionStore {
  persist(session: SessionData): Promise<void>;
  find(userId: string, sessionId: string): Promise<SessionData | null>;
  invalidate(userId: string, sessionId: string): Promise<void>;
  invalidateAll(userId: string): Promise<void>;
  list(userId: string): Promise<SessionData[]>;
}
