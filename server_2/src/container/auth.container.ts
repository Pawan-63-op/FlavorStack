import { getAuthConfig, getEmailConfig } from '../config';
import { ITokenService } from '../domain/identity/services/ITokenService';
import { IPasswordHasher } from '../domain/identity/services/IPasswordHasher';
import { IRefreshTokenHasher } from '../domain/identity/services/IRefreshTokenHasher';
import { IOtpGenerator } from '../domain/identity/services/IOtpGenerator';
import { IEmailProvider } from '../domain/identity/services/IEmailProvider';
import { ISmsProvider } from '../domain/identity/services/ISmsProvider';
import { ISessionStore } from '../domain/identity/services/ISessionStore';
import { IOtpStore } from '../domain/identity/services/IOtpStore';
import { IRbacService } from '../domain/identity/services/IRbacService';
import { JwtTokenService } from '../infrastructure/auth/JwtTokenService';
import { BcryptPasswordHasher } from '../infrastructure/auth/BcryptPasswordHasher';
import { Sha256RefreshTokenHasher } from '../infrastructure/auth/Sha256RefreshTokenHasher';
import { CryptoOtpService } from '../infrastructure/auth/CryptoOtpService';
import { RbacService } from '../infrastructure/auth/RbacService';
import { ResendEmailProvider } from '../infrastructure/external/email/ResendEmailProvider';
import { LoggerSmsProvider } from '../infrastructure/external/sms/LoggerSmsProvider';
import { SessionStore } from '../infrastructure/redis/SessionStore';
import { OtpStore } from '../infrastructure/redis/OtpStore';
import { RateLimiter } from '../infrastructure/redis/RateLimiter';
import { RedisClient } from '../infrastructure/redis/client';

export interface AuthContainer {
  tokenService: ITokenService;
  passwordHasher: IPasswordHasher;
  refreshTokenHasher: IRefreshTokenHasher;
  otpGenerator: IOtpGenerator;
  emailProvider: IEmailProvider;
  smsProvider: ISmsProvider;
  sessionStore: ISessionStore;
  otpStore: IOtpStore;
  rbacService: IRbacService;
  rateLimiter: RateLimiter;
}

/**
 * Wires every Identity auth/crypto/session/messaging interface to its concrete
 * implementation. `redisClient` must already be connected (`await redisClient.connect()`)
 * before this is called — `SessionStore`/`OtpStore` issue commands lazily and a
 * not-yet-ready client surfaces as runtime errors on first use, not at construction.
 */
export function createAuthContainer(redisClient: RedisClient): AuthContainer {
  const authConfig = getAuthConfig();

  const tokenService = new JwtTokenService({
    privateKey: authConfig.jwtPrivateKey,
    publicKey: authConfig.jwtPublicKey,
    accessTtl: authConfig.accessTtlSeconds,
    refreshTtl: authConfig.refreshTtlSeconds,
    issuer: authConfig.issuer,
    audience: authConfig.audience,
  });

  return {
    tokenService,
    passwordHasher: new BcryptPasswordHasher(authConfig.bcryptRounds),
    refreshTokenHasher: new Sha256RefreshTokenHasher(),
    otpGenerator: new CryptoOtpService(),
    emailProvider: new ResendEmailProvider(getEmailConfig()),
    smsProvider: new LoggerSmsProvider(),
    sessionStore: new SessionStore(redisClient),
    otpStore: new OtpStore(redisClient),
    rbacService: new RbacService(),
    rateLimiter: new RateLimiter(redisClient),
  };
}
