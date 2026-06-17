import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getAuthConfig } from '../../../config/auth';

describe('getAuthConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns sensible defaults when only keys are set', () => {
    delete process.env.JWT_PRIVATE_KEY_PATH;
    delete process.env.JWT_PUBLIC_KEY_PATH;
    delete process.env.JWT_ACCESS_TTL_SECONDS;
    delete process.env.JWT_REFRESH_TTL_SECONDS;
    delete process.env.JWT_ISSUER;
    delete process.env.JWT_AUDIENCE;
    delete process.env.BCRYPT_ROUNDS;
    delete process.env.OTP_LENGTH;
    process.env.JWT_PRIVATE_KEY = 'private-key';
    process.env.JWT_PUBLIC_KEY = 'public-key';

    expect(getAuthConfig()).toEqual({
      jwtPrivateKey: 'private-key',
      jwtPublicKey: 'public-key',
      accessTtlSeconds: 900,
      refreshTtlSeconds: 2592000,
      issuer: 'flavorstack',
      audience: 'flavorstack-clients',
      bcryptRounds: 12,
      otpLength: 6,
    });
  });

  it('reads overrides from environment variables', () => {
    process.env.JWT_PRIVATE_KEY = 'private-key';
    process.env.JWT_PUBLIC_KEY = 'public-key';
    process.env.JWT_ACCESS_TTL_SECONDS = '60';
    process.env.JWT_REFRESH_TTL_SECONDS = '120';
    process.env.JWT_ISSUER = 'custom-issuer';
    process.env.JWT_AUDIENCE = 'custom-audience';
    process.env.BCRYPT_ROUNDS = '10';
    process.env.OTP_LENGTH = '4';

    const config = getAuthConfig();

    expect(config.accessTtlSeconds).toBe(60);
    expect(config.refreshTtlSeconds).toBe(120);
    expect(config.issuer).toBe('custom-issuer');
    expect(config.audience).toBe('custom-audience');
    expect(config.bcryptRounds).toBe(10);
    expect(config.otpLength).toBe(4);
  });

  it('replaces escaped newlines in PEM keys from env vars', () => {
    process.env.JWT_PRIVATE_KEY = '-----BEGIN KEY-----\\nabc\\n-----END KEY-----';
    process.env.JWT_PUBLIC_KEY = 'public-key';

    expect(getAuthConfig().jwtPrivateKey).toBe('-----BEGIN KEY-----\nabc\n-----END KEY-----');
  });

  it('falls back to reading the key from JWT_PRIVATE_KEY_PATH / JWT_PUBLIC_KEY_PATH when the env var is unset', () => {
    delete process.env.JWT_PRIVATE_KEY;
    delete process.env.JWT_PUBLIC_KEY;

    const privatePath = join(tmpdir(), 'jwt-private-test.pem');
    const publicPath = join(tmpdir(), 'jwt-public-test.pem');
    writeFileSync(privatePath, 'private-from-file');
    writeFileSync(publicPath, 'public-from-file');
    process.env.JWT_PRIVATE_KEY_PATH = privatePath;
    process.env.JWT_PUBLIC_KEY_PATH = publicPath;

    try {
      const config = getAuthConfig();
      expect(config.jwtPrivateKey).toBe('private-from-file');
      expect(config.jwtPublicKey).toBe('public-from-file');
    } finally {
      unlinkSync(privatePath);
      unlinkSync(publicPath);
    }
  });

  it('returns empty strings for keys when neither the env var nor the path is set', () => {
    delete process.env.JWT_PRIVATE_KEY;
    delete process.env.JWT_PUBLIC_KEY;
    delete process.env.JWT_PRIVATE_KEY_PATH;
    delete process.env.JWT_PUBLIC_KEY_PATH;

    const config = getAuthConfig();

    expect(config.jwtPrivateKey).toBe('');
    expect(config.jwtPublicKey).toBe('');
  });
});
