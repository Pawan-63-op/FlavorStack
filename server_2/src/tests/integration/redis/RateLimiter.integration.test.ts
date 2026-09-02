import { StartedRedisContainer } from '@testcontainers/redis';
import { RedisClient } from '../../../infrastructure/redis/client';
import { RateLimiter, RateLimitAction, RateLimitRule } from '../../../infrastructure/redis/RateLimiter';
import { rateLimitKey } from '../../../infrastructure/redis/keys';
import { startRedisContainer, StartedTestRedis } from './redis-container';

const RULES: Record<RateLimitAction, RateLimitRule> = {
  login: { windowSeconds: 2, max: 5 },
  'otp-generation': { windowSeconds: 2, max: 3 },
  'otp-verification': { windowSeconds: 2, max: 5 },
  'password-reset': { windowSeconds: 2, max: 3 },
  'catalog-search': { windowSeconds: 2, max: 5 },
};

describe('RateLimiter', () => {
  let started: StartedTestRedis;
  let container: StartedRedisContainer;
  let client: RedisClient;
  let limiter: RateLimiter;

  beforeAll(async () => {
    started = await startRedisContainer();
    container = started.container;
    client = new RedisClient(started.config);
    await client.connect();
    limiter = new RateLimiter(client, RULES);
  });

  afterAll(async () => {
    await client.shutdown();
    await container.stop();
  });

  beforeEach(async () => {
    await client.getClient().flushall();
  });

  it('allows calls under the limit with decreasing remaining', async () => {
    const first = await limiter.check('login', 'user-1');
    const second = await limiter.check('login', 'user-1');

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(4);
    expect(first.retryAfter).toBe(0);

    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(3);
  });

  it('blocks the (max+1)th call with a sensible retryAfter', async () => {
    for (let i = 0; i < RULES.login.max; i++) {
      const r = await limiter.check('login', 'user-1');
      expect(r.allowed).toBe(true);
    }

    const blocked = await limiter.check('login', 'user-1');

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.retryAfter).toBeLessThanOrEqual(RULES.login.windowSeconds);
  });

  it('allows requests again after the window expires', async () => {
    for (let i = 0; i < RULES['otp-generation'].max; i++) {
      await limiter.check('otp-generation', 'user-1');
    }
    expect((await limiter.check('otp-generation', 'user-1')).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, RULES['otp-generation'].windowSeconds * 1000 + 200));

    const result = await limiter.check('otp-generation', 'user-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(RULES['otp-generation'].max - 1);
  });

  it('counts requests atomically under concurrency without overshooting max', async () => {
    const max = RULES['otp-verification'].max;

    const results = await Promise.all(
      Array.from({ length: 20 }, () => limiter.check('otp-verification', 'concurrent-user')),
    );

    const allowedCount = results.filter((r) => r.allowed).length;
    expect(allowedCount).toBe(max);

    const cardinality = await client.getClient().zcard(rateLimitKey('otp-verification', 'concurrent-user'));
    expect(cardinality).toBe(max);

    for (const r of results.filter((r) => !r.allowed)) {
      expect(r.remaining).toBe(0);
      expect(r.retryAfter).toBeGreaterThan(0);
    }
  });

  it('isolates limits per identifier', async () => {
    for (let i = 0; i < RULES['password-reset'].max; i++) {
      await limiter.check('password-reset', 'user-a');
    }
    expect((await limiter.check('password-reset', 'user-a')).allowed).toBe(false);

    const other = await limiter.check('password-reset', 'user-b');
    expect(other.allowed).toBe(true);
    expect(other.remaining).toBe(RULES['password-reset'].max - 1);
  });

  it('isolates limits per action for the same identifier', async () => {
    for (let i = 0; i < RULES['otp-generation'].max; i++) {
      await limiter.check('otp-generation', 'user-1');
    }
    expect((await limiter.check('otp-generation', 'user-1')).allowed).toBe(false);

    const login = await limiter.check('login', 'user-1');
    expect(login.allowed).toBe(true);
  });

  it('sets an expiry on the key so idle windows self-evict', async () => {
    await limiter.check('login', 'user-1');

    const ttl = await client.getClient().ttl(rateLimitKey('login', 'user-1'));
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(RULES.login.windowSeconds);
  });
});
