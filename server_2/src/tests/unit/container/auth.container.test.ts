import { generateKeyPairSync } from 'crypto';
import { createAuthContainer } from '../../../container/auth.container';
import { RedisClient } from '../../../infrastructure/redis/client';
import { JwtTokenService } from '../../../infrastructure/auth/JwtTokenService';
import { BcryptPasswordHasher } from '../../../infrastructure/auth/BcryptPasswordHasher';
import { Sha256RefreshTokenHasher } from '../../../infrastructure/auth/Sha256RefreshTokenHasher';
import { CryptoOtpService } from '../../../infrastructure/auth/CryptoOtpService';
import { ResendEmailProvider } from '../../../infrastructure/external/email/ResendEmailProvider';
import { LoggerSmsProvider } from '../../../infrastructure/external/sms/LoggerSmsProvider';
import { SessionStore } from '../../../infrastructure/redis/SessionStore';
import { OtpStore } from '../../../infrastructure/redis/OtpStore';
import { RbacService } from '../../../infrastructure/auth/RbacService';
import { RateLimiter } from '../../../infrastructure/redis/RateLimiter';
import { TokenPayLoad } from '../../../domain/identity/value-objects/TokenPayLoad.vo';
import { USER_ROLE } from '../../../domain/identity/enums/user-role.enum';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function fakeRedisClient(): RedisClient {
  return { getClient: () => ({}) } as unknown as RedisClient;
}

function fakePayload(): TokenPayLoad {
  const now = Math.floor(Date.now() / 1000);
  return {
    userId: 'user-1',
    role: USER_ROLE.CUSTOMER,
    sessionId: 'session-1',
    jti: 'jti-1',
    tokenVersion: 1,
    iat: now,
    exp: now,
  };
}

describe('createAuthContainer', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.JWT_PRIVATE_KEY = privateKey;
    process.env.JWT_PUBLIC_KEY = publicKey;
    process.env.JWT_ACCESS_TTL_SECONDS = '1234';
    process.env.JWT_REFRESH_TTL_SECONDS = '5678';
    process.env.JWT_ISSUER = 'flavorstack-test';
    process.env.JWT_AUDIENCE = 'flavorstack-test-clients';
    process.env.BCRYPT_ROUNDS = '4';
    process.env.RESEND_API_KEY = 'test-resend-key';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns concrete implementations satisfying every AuthContainer field', () => {
    const container = createAuthContainer(fakeRedisClient());

    expect(container.tokenService).toBeInstanceOf(JwtTokenService);
    expect(container.passwordHasher).toBeInstanceOf(BcryptPasswordHasher);
    expect(container.refreshTokenHasher).toBeInstanceOf(Sha256RefreshTokenHasher);
    expect(container.otpGenerator).toBeInstanceOf(CryptoOtpService);
    expect(container.emailProvider).toBeInstanceOf(ResendEmailProvider);
    expect(container.smsProvider).toBeInstanceOf(LoggerSmsProvider);
    expect(container.sessionStore).toBeInstanceOf(SessionStore);
    expect(container.otpStore).toBeInstanceOf(OtpStore);
    expect(container.rbacService).toBeInstanceOf(RbacService);
    expect(container.rateLimiter).toBeInstanceOf(RateLimiter);
  });

  it('maps AuthConfig fields onto JwtTokenServiceConfig explicitly (not via spread)', () => {
    const container = createAuthContainer(fakeRedisClient());

    const token = container.tokenService.generateAccessToken(fakePayload());
    const decoded = container.tokenService.decode(token);
    const verified = container.tokenService.verify(token);

    expect(verified.isSuccess).toBe(true);
    expect(decoded!.exp - decoded!.iat).toBe(1234);
  });

  it('maps AuthConfig.bcryptRounds onto the BcryptPasswordHasher cost factor', async () => {
    const container = createAuthContainer(fakeRedisClient());

    const hash = await container.passwordHasher.hash('Sup3r$ecret1');

    expect(hash.startsWith('$2b$04$')).toBe(true);
  });
});
