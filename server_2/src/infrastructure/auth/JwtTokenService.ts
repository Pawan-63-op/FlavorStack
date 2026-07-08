import jwt from 'jsonwebtoken';
import { ITokenService } from '../../domain/identity/services/ITokenService';
import { TokenPayLoad } from '../../domain/identity/value-objects/TokenPayLoad.vo';
import { UserRole } from '../../domain/identity/enums/user-role.enum';
import { Result } from '../../domain/shared/Result';

export interface JwtTokenServiceConfig {
  privateKey: string;
  publicKey: string;
  accessTtl: number;
  refreshTtl: number;
  issuer: string;
  audience: string;
}

/** The subset of claims this service signs. iat/exp are populated by jsonwebtoken. */
interface JwtClaims {
  userId: string;
  role: UserRole;
  sessionId: string;
  jti: string;
  tokenVersion: number;
}

/**
 * RS256 JWT service. Access TTL 15m / refresh TTL 30d come from config — the
 * service is the single source of truth for token lifetimes, so the caller's
 * iat/exp on TokenPayLoad are advisory and never passed into jwt.sign
 * (jsonwebtoken rejects a payload carrying `exp` when `expiresIn` is given).
 */
export class JwtTokenService implements ITokenService {
  constructor(private readonly config: JwtTokenServiceConfig) {}

  generateAccessToken(payload: TokenPayLoad): string {
    return this.sign(payload, this.config.accessTtl);
  }

  generateRefreshToken(payload: TokenPayLoad): string {
    return this.sign(payload, this.config.refreshTtl);
  }

  verify(token: string): Result<TokenPayLoad> {
    try {
      const decoded = jwt.verify(token, this.config.publicKey, {
        algorithms: ['RS256'],
        issuer: this.config.issuer,
        audience: this.config.audience,
      }) as jwt.JwtPayload;

      return Result.ok(this.toPayload(decoded));
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return Result.fail('token_expired');
      }
      return Result.fail('invalid_token');
    }
  }

  decode(token: string): TokenPayLoad | null {
    const decoded = jwt.decode(token);
    if (!decoded || typeof decoded === 'string') return null;
    const claims = decoded as jwt.JwtPayload;
    if (
      typeof claims.userId !== 'string' ||
      typeof claims.role !== 'string' ||
      typeof claims.sessionId !== 'string' ||
      typeof claims.jti !== 'string' ||
      typeof claims.tokenVersion !== 'number'
    ) {
      return null;
    }
    return this.toPayload(claims);
  }

  private sign(payload: TokenPayLoad, expiresIn: number): string {
    const claims: JwtClaims = {
      userId: payload.userId,
      role: payload.role,
      sessionId: payload.sessionId,
      jti: payload.jti,
      tokenVersion: payload.tokenVersion,
    };

    return jwt.sign(claims, this.config.privateKey, {
      algorithm: 'RS256',
      expiresIn,
      issuer: this.config.issuer,
      audience: this.config.audience,
    });
  }

  private toPayload(claims: jwt.JwtPayload): TokenPayLoad {
    return {
      userId: claims.userId as string,
      role: claims.role as UserRole,
      sessionId: claims.sessionId as string,
      jti: claims.jti as string,
      tokenVersion: claims.tokenVersion as number,
      iat: claims.iat as number,
      exp: claims.exp as number,
    };
  }
}
