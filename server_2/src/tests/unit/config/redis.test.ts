import { getRedisConfig } from '../../../config/redis';

describe('getRedisConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns sensible defaults when no env vars are set', () => {
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_PASSWORD;
    delete process.env.REDIS_DB;
    delete process.env.REDIS_TLS;
    delete process.env.REDIS_KEY_PREFIX;
    delete process.env.REDIS_CONNECT_TIMEOUT_MS;
    delete process.env.REDIS_MAX_RETRIES_PER_REQUEST;

    expect(getRedisConfig()).toEqual({
      host: '127.0.0.1',
      port: 6379,
      password: undefined,
      db: undefined,
      tls: false,
      keyPrefix: undefined,
      connectTimeoutMs: 10000,
      maxRetriesPerRequest: 3,
    });
  });

  it('reads overrides from environment variables', () => {
    process.env.REDIS_HOST = 'redis.internal';
    process.env.REDIS_PORT = '6380';
    process.env.REDIS_PASSWORD = 'secret';
    process.env.REDIS_DB = '2';
    process.env.REDIS_TLS = 'true';
    process.env.REDIS_KEY_PREFIX = 'flavorstack:';
    process.env.REDIS_CONNECT_TIMEOUT_MS = '5000';
    process.env.REDIS_MAX_RETRIES_PER_REQUEST = '7';

    expect(getRedisConfig()).toEqual({
      host: 'redis.internal',
      port: 6380,
      password: 'secret',
      db: 2,
      tls: true,
      keyPrefix: 'flavorstack:',
      connectTimeoutMs: 5000,
      maxRetriesPerRequest: 7,
    });
  });
});
