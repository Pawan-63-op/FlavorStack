import { generateKeyPairSync } from 'crypto';
import request from 'supertest';
import type { Express } from 'express';

import { bootstrap, shutdown, AppContainer } from '../../../container';
import { createApp } from '../../../app';
import { connectDB } from '../../../infrastructure/database/connection';
import { getTestMongoUri } from '../../setup';
import { startRedisContainer, StartedTestRedis } from '../../integration/redis/redis-container';

jest.setTimeout(180000);

const ORIGINAL_ENV = { ...process.env };

function extractCookie(res: request.Response, name: string): string {
  const setCookie = (res.headers['set-cookie'] ?? []) as unknown as string[];
  const found = setCookie.find((c) => c.startsWith(`${name}=`));
  if (!found) throw new Error(`cookie "${name}" not found in response`);
  return found.split(';')[0];
}

function maybeCookie(res: request.Response, name: string): string | null {
  const setCookie = (res.headers['set-cookie'] ?? []) as unknown as string[];
  const found = setCookie.find((c) => c.startsWith(`${name}=`));
  return found ? found.split(';')[0] : null;
}

describe('Auth /refresh — concurrent rotation race (concurrency)', () => {
  let app: AppContainer;
  let redis: StartedTestRedis;
  let server: Express;
  let agent: ReturnType<typeof request>;

  const email = 'race.refresh@example.com';
  const password = 'Str0ng!Pass1';

  beforeAll(async () => {
    redis = await startRedisContainer();

    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    process.env.MONGO_URI = getTestMongoUri();
    process.env.REDIS_HOST = redis.config.host;
    process.env.REDIS_PORT = String(redis.config.port);
    process.env.JWT_PRIVATE_KEY = privateKey;
    process.env.JWT_PUBLIC_KEY = publicKey;
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.OUTBOX_POLL_INTERVAL_MS = '500';

    app = await bootstrap();
    app.auth.emailProvider.sendVerification = jest.fn().mockResolvedValue(undefined);
    app.auth.emailProvider.sendPasswordReset = jest.fn().mockResolvedValue(undefined);
    app.auth.emailProvider.sendNotification = jest.fn().mockResolvedValue(undefined);

    server = createApp(app);
    agent = request(server);

    await agent.post('/api/v1/auth/register').send({
      role: 'CUSTOMER',
      customer: { name: 'Race Refresh', email, phone: '+14155550190', password },
    });
  });

  afterAll(async () => {
    if (app) {
      await shutdown(app);
      await connectDB(getTestMongoUri());
    }
    if (redis) await redis.container.stop();
    process.env = { ...ORIGINAL_ENV };
  });

  it('N concurrent refreshes with the same token never crash or globally lock the user out', async () => {
    const login = await agent.post('/api/v1/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    const refreshCookie = extractCookie(login, 'refresh_token');

    const FANOUT = 4;
    const responses = await Promise.all(
      Array.from({ length: FANOUT }, () => agent.post('/api/v1/auth/refresh').set('Cookie', [refreshCookie]))
    );

    const statuses = responses.map((r) => r.status);

    for (const s of statuses) {
      expect([200, 401, 403]).toContain(s);
    }

    const winners = responses.filter((r) => r.status === 200);
    expect(winners.length).toBeGreaterThanOrEqual(1);
    const survivingRefreshTokens = winners
      .map((r) => maybeCookie(r, 'refresh_token'))
      .filter((c): c is string => c !== null && c !== refreshCookie);
    expect(survivingRefreshTokens.length).toBeGreaterThanOrEqual(1);

    console.log(`[refresh-race] statuses=${JSON.stringify(statuses)} rotated=${winners.length}/${FANOUT}`);

    const followUp = await agent.post('/api/v1/auth/refresh').set('Cookie', [survivingRefreshTokens[0]]);
    expect(followUp.status).toBe(200);
    expect(maybeCookie(followUp, 'refresh_token')).not.toBeNull();
  });
});
