import { randomUUID } from 'crypto';
import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import { Email } from '../../../domain/identity/value-objects/Email.vo';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { IPasswordHasher } from '../../../domain/identity/services/IPasswordHasher';
import { ITokenService } from '../../../domain/identity/services/ITokenService';
import { IRefreshTokenHasher } from '../../../domain/identity/services/IRefreshTokenHasher';
import { ISessionStore } from '../../../domain/identity/services/ISessionStore';
import { LoginDto } from '../dtos/LoginDto';
import { AuthResponse } from '../responses/AuthResponse';
import { toAuthResponse } from '../responses/mappers';

const ACCESS_TOKEN_TTL_SECONDS = 900; // 15 minutes
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class Login {
  constructor(
    private userRepo: IUserRepository,
    private passwordHasher: IPasswordHasher,
    private tokenService: ITokenService,
    private sessionStore: ISessionStore,
    private refreshTokenHasher: IRefreshTokenHasher,
  ) {}

  async execute(dto: LoginDto): Promise<Result<AuthResponse>> {
    // 1. Validate email VO
    const emailResult = Email.create(dto.email);
    if (emailResult.isFailure) return Result.fail(emailResult.getError());
    const email = emailResult.getValue();

    // 2. Find user (no enumeration — return same error for not found)
    const user = await this.userRepo.findByEmail(email);
    if (!user) return Result.fail(new NotFoundError('invalid_credentials'));

    // 3. Check if account can attempt login
    if (!user.canAttemptLogin()) {
      return Result.fail(new ForbiddenError('account_locked_or_banned'));
    }

    // 4. Verify password
    const passwordMatch = await this.passwordHasher.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      user.incrementLoginAttempts();
      if (user.shouldLockAfterAttempt()) {
        user.lockAccount();
      }
      // Plain update — no tx, no outbox, no event
      await this.userRepo.update(user);
      return Result.fail(new ForbiddenError('invalid_credentials'));
    }

    // 5. Password ok — record login
    user.recordLogin(dto.ip ?? '');
    await this.userRepo.update(user);

    // 6. Build session
    const sessionId = randomUUID();
    const jti = randomUUID();
    const now = Math.floor(Date.now() / 1000);

    const payload = {
      userId: user._id,
      role: user.role,
      sessionId,
      jti,
      tokenVersion: user.tokenVersion,
      iat: now,
      exp: now + ACCESS_TOKEN_TTL_SECONDS,
    };

    // 7. Generate tokens
    const accessToken = this.tokenService.generateAccessToken(payload);
    const refreshToken = this.tokenService.generateRefreshToken(payload);

    // 8. Hash refresh token before storing (SHA-256, full-length — bcrypt is passwords-only)
    const refreshTokenHash = this.refreshTokenHasher.hash(refreshToken);

    // 9. Persist session
    const now2 = new Date();
    await this.sessionStore.persist({
      userId: user._id,
      sessionId,
      refreshTokenHash,
      deviceInfo: dto.device,
      ipAddress: dto.ip,
      userAgent: dto.userAgent,
      createdAt: now2,
      expiresAt: new Date(now2.getTime() + REFRESH_TOKEN_TTL_MS),
    });

    return Result.ok(toAuthResponse(user, accessToken, refreshToken, ACCESS_TOKEN_TTL_SECONDS));
  }
}
