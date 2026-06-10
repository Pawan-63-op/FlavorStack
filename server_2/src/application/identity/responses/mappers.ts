import { BaseUser } from '../../../domain/identity/entities/BaseUser';
import { SessionData } from '../../../domain/identity/services/ISessionStore';
import { UserResponse } from './UserResponse';
import { AuthResponse } from './AuthResponse';
import { SessionResponse } from './SessionResponse';

export function toUserResponse(user: BaseUser): UserResponse {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    avatarUrl: user.avatarUrl || undefined,
    createdAt: user.createdAt,
  };
}

export function toAuthResponse(
  user: BaseUser,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
): AuthResponse {
  return {
    user: toUserResponse(user),
    accessToken,
    refreshToken,
    expiresIn,
  };
}

export function toSessionResponse(session: SessionData): SessionResponse {
  // NEVER expose refreshTokenHash
  return {
    sessionId: session.sessionId,
    device: session.deviceInfo,
    ip: session.ipAddress,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  };
}
