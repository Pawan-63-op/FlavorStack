import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ITokenService } from '../../../domain/identity/services/ITokenService';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import { ACCESS_TOKEN_COOKIE } from '../http/cookies';

const BEARER_PREFIX = 'Bearer ';

function extractToken(req: Request): string | undefined {
  const cookieToken = req.cookies?.[ACCESS_TOKEN_COOKIE];
  if (typeof cookieToken === 'string' && cookieToken.length > 0) return cookieToken;

  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith(BEARER_PREFIX)) {
    const bearer = header.slice(BEARER_PREFIX.length).trim();
    if (bearer.length > 0) return bearer;
  }

  return undefined;
}

export function authenticate(tokenService: ITokenService): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const token = extractToken(req);
    if (!token) {
      next(new ForbiddenError('invalid_token'));
      return;
    }

    const result = tokenService.verify(token);
    if (result.isFailure) {
      next(new ForbiddenError('invalid_token'));
      return;
    }

    const payload = result.getValue();
    req.user = {
      userId: payload.userId,
      role: payload.role,
      sessionId: payload.sessionId,
      jti: payload.jti,
      tokenVersion: payload.tokenVersion,
    };
    next();
  };
}
