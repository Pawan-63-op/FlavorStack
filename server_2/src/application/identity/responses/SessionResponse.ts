export interface SessionResponse {
  sessionId: string;
  device?: string;
  ip?: string;
  createdAt: Date;
  expiresAt: Date;
}
