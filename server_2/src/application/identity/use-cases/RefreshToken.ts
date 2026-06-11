import { randomUUID } from 'crypto';
import { Result } from '../../../domain/shared/Result';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { ITokenService } from '../../../domain/identity/services/ITokenService';
import { IRefreshTokenHasher } from '../../../domain/identity/services/IRefreshTokenHasher';
import { ISessionStore } from '../../../domain/identity/services/ISessionStore';
import { RefreshTokenDto } from '../dtos/RefreshTokenDto';
import { AuthResponse } from '../responses/AuthResponse';
import { toAuthResponse } from '../responses/mappers';

const ACCESS_TOKEN_TTL_SECONDS = 900; // 15 minutes
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class RefreshToken {
  constructor(
    private userRepo: IUserRepository,
    private tokenService: ITokenService,
    private sessionStore: ISessionStore,
    private refreshTokenHasher: IRefreshTokenHasher,
  ) {}

  async execute(dto: RefreshTokenDto): Promise<Result<AuthResponse>> {
    // 1. Verify token signature
    const verifyResult = this.tokenService.verify(dto.refreshToken);
    if (verifyResult.isFailure) {
      return Result.fail(new ForbiddenError('invalid_token'));
    }
    const payload = verifyResult.getValue();
    const { userId, sessionId, role } = payload;

    // 2. Find session
    const session = await this.sessionStore.find(userId, sessionId);
    if (!session) {
      return Result.fail(new ForbiddenError('session_not_found'));
    }

    // 3. Verify refresh token hash (detect reuse)
    const hashMatch = this.refreshTokenHasher.compare(dto.refreshToken, session.refreshTokenHash);
    if (!hashMatch) {
      // Token reuse detected — invalidate all sessions for this user
      await this.sessionStore.invalidateAll(userId);
      return Result.fail(new ForbiddenError('token_reuse_detected'));
    }

    // 4. Load user
    const user = await this.userRepo.findById(userId);
    if (!user || !user.isActive) {
      return Result.fail(new ForbiddenError('user_not_found_or_inactive'));
    }

    // 4b. Reject stale tokenVersion (e.g. password changed / sessions revoked since issuance)
    if (payload.tokenVersion !== user.tokenVersion) {
      return Result.fail(new ForbiddenError('token_version_mismatch'));
    }

    // 5. Invalidate old session
    await this.sessionStore.invalidate(userId, sessionId);

    // 6. Build new session
    const newSessionId = randomUUID();
    const newJti = randomUUID();
    const now = Math.floor(Date.now() / 1000);

    const newPayload = {
      userId,
      role,
      sessionId: newSessionId,
      jti: newJti,
      tokenVersion: user.tokenVersion,
      iat: now,
      exp: now + ACCESS_TOKEN_TTL_SECONDS,
    };

    // 7. Issue new tokens
    const newAccessToken = this.tokenService.generateAccessToken(newPayload);
    const newRefreshToken = this.tokenService.generateRefreshToken(newPayload);

    // 8. Hash new refresh token before storing (SHA-256, full-length — bcrypt is passwords-only)
    const newRefreshTokenHash = this.refreshTokenHasher.hash(newRefreshToken);

    // 9. Persist new session
    const now2 = new Date();
    await this.sessionStore.persist({
      userId,
      sessionId: newSessionId,
      refreshTokenHash: newRefreshTokenHash,
      deviceInfo: dto.device,
      ipAddress: dto.ip,
      userAgent: dto.userAgent,
      createdAt: now2,
      expiresAt: new Date(now2.getTime() + REFRESH_TOKEN_TTL_MS),
    });

    return Result.ok(toAuthResponse(user, newAccessToken, newRefreshToken, ACCESS_TOKEN_TTL_SECONDS));
  }
}
