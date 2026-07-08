import type { Socket } from 'socket.io';
import { ITokenService } from '../../../domain/identity/services/ITokenService';
import { ACCESS_TOKEN_COOKIE } from '../../../api/v1/http/cookies';

const BEARER_PREFIX = 'Bearer ';

export interface SocketUser {
  userId: string;
  role: string;
  sessionId: string;
  jti: string;
  tokenVersion: number;
}

function parseCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

function extractToken(socket: Socket): string | undefined {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.length > 0) return authToken;

  const header = socket.handshake.headers.authorization;
  if (typeof header === 'string' && header.startsWith(BEARER_PREFIX)) {
    const bearer = header.slice(BEARER_PREFIX.length).trim();
    if (bearer.length > 0) return bearer;
  }

  return parseCookie(socket.handshake.headers.cookie, ACCESS_TOKEN_COOKIE);
}

/** Returns a Socket.IO middleware `(socket, next)` that gates the connection on a valid JWT. */
export function socketAuth(tokenService: ITokenService) {
  return (socket: Socket, next: (err?: Error) => void): void => {
    const token = extractToken(socket);
    if (!token) {
      next(new Error('unauthorized'));
      return;
    }

    const result = tokenService.verify(token);
    if (result.isFailure) {
      next(new Error('unauthorized'));
      return;
    }

    const payload = result.getValue();
    const user: SocketUser = {
      userId: payload.userId,
      role: payload.role,
      sessionId: payload.sessionId,
      jti: payload.jti,
      tokenVersion: payload.tokenVersion,
    };
    socket.data.user = user;
    next();
  };
}
