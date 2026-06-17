// Commerce Checkout API e2e (Phase 12 Batch 1; Phase 13 read endpoints) — black-box over the real HTTP API
// (supertest + createApp) against MongoMemoryReplSet (tests/setup.ts) + a disposable Redis.
//
// Scope: the HTTP surface introduced by this batch — auth, the required Idempotency-Key header
// (requireIdempotencyKey), body validation (checkoutSchema), and the controller → Checkout use-case wiring.
// The checkout green-path pricing + idempotent replay are proven deterministically at the unit
// (Checkout.test.ts) and integration (checkout.integration.test.ts) tiers without depending on the async
// catalog projection; here we assert the request reaches the use case (a valid request with no cart returns
// 404), keeping this suite fast and free of catalog seeding.
import { generateKeyPairSync, randomUUID } from 'crypto';
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

const ADDRESS = {
  label: 'Home',
  street: '1 MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  pinCode: '560001',
  coordinates: { lat: 12.97, lng: 77.59 },
};

const KEY = '11111111-1111-1111-1111-111111111111';

describe('Commerce Checkout API e2e (Phase 12)', () => {
  let app: AppContainer;
  let redis: StartedTestRedis;
  let server: Express;
  let agent: ReturnType<typeof request>;

  let customerCookie: string;

  const slug = `e2e-checkout-${randomUUID().slice(0, 8)}`;

  async function registerAndLogin(email: string, phone: string): Promise<string> {
    const reg = await agent.post('/api/v1/auth/register').send({
      role: 'CUSTOMER',
      customer: { name: 'User E2E', email, phone, password: 'Str0ng!Pass1' },
    });
    expect(reg.status).toBe(201);
    const res = await agent.post('/api/v1/auth/login').send({ email, password: 'Str0ng!Pass1' });
    expect(res.status).toBe(200);
    return extractCookie(res, 'access_token');
  }

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

    customerCookie = await registerAndLogin(`customer.${slug}@example.com`, '+14155550123');
  });

  afterAll(async () => {
    if (app) {
      await shutdown(app);
      await connectDB(getTestMongoUri());
    }
    if (redis) await redis.container.stop();
    process.env = { ...ORIGINAL_ENV };
  });

  it('rejects unauthenticated checkout (401)', async () => {
    const res = await agent
      .post('/api/v1/checkout')
      .set('Idempotency-Key', KEY)
      .send({ paymentMethod: 'UPI', deliveryAddress: ADDRESS });
    expect(res.status).toBe(401);
  });

  it('rejects checkout without an Idempotency-Key header (422)', async () => {
    const res = await agent
      .post('/api/v1/checkout')
      .set('Cookie', customerCookie)
      .send({ paymentMethod: 'UPI', deliveryAddress: ADDRESS });
    expect(res.status).toBe(422);
  });

  it('rejects checkout with a malformed Idempotency-Key header (422)', async () => {
    const res = await agent
      .post('/api/v1/checkout')
      .set('Cookie', customerCookie)
      .set('Idempotency-Key', 'not-a-uuid')
      .send({ paymentMethod: 'UPI', deliveryAddress: ADDRESS });
    expect(res.status).toBe(422);
  });

  it('rejects checkout with an invalid body (422)', async () => {
    const res = await agent
      .post('/api/v1/checkout')
      .set('Cookie', customerCookie)
      .set('Idempotency-Key', KEY)
      .send({ paymentMethod: 'BITCOIN', deliveryAddress: ADDRESS });
    expect(res.status).toBe(422);
  });

  it('reaches the use case and returns 404 when the customer has no cart', async () => {
    const res = await agent
      .post('/api/v1/checkout')
      .set('Cookie', customerCookie)
      .set('Idempotency-Key', randomUUID())
      .send({ paymentMethod: 'UPI', deliveryAddress: ADDRESS });
    expect(res.status).toBe(404);
  });

  // PreviewCheckout (Phase 13). The green-path pricing depends on the async catalog projection/ACL
  // and is proven at the unit tier (PreviewCheckout.test.ts); here we assert the HTTP surface only.
  describe('POST /checkout/preview', () => {
    const POINT = { deliveryPoint: { lat: 12.97, lng: 77.59 } };

    it('rejects unauthenticated preview (401)', async () => {
      const res = await agent.post('/api/v1/checkout/preview').send(POINT);
      expect(res.status).toBe(401);
    });

    it('rejects a preview with an invalid body (422)', async () => {
      const res = await agent
        .post('/api/v1/checkout/preview')
        .set('Cookie', customerCookie)
        .send({ deliveryPoint: { lat: 200, lng: 0 } });
      expect(res.status).toBe(422);
    });

    it('reaches the use case and returns 404 when the customer has no cart', async () => {
      const res = await agent
        .post('/api/v1/checkout/preview')
        .set('Cookie', customerCookie)
        .send(POINT);
      expect(res.status).toBe(404);
    });
  });

  // OrderRequest query (Phase 13). Ownership/happy paths need a persisted OrderRequest (full checkout
  // flow) and are proven at the unit tier (GetOrderRequest.test.ts); here we assert the HTTP surface only.
  describe('GET /order-requests/:id', () => {
    it('rejects unauthenticated access (401)', async () => {
      const res = await agent.get(`/api/v1/order-requests/${randomUUID()}`);
      expect(res.status).toBe(401);
    });

    it('rejects a non-UUID id (422)', async () => {
      const res = await agent
        .get('/api/v1/order-requests/not-a-uuid')
        .set('Cookie', customerCookie);
      expect(res.status).toBe(422);
    });

    it('reaches the use case and returns 404 for an unknown order request', async () => {
      const res = await agent
        .get(`/api/v1/order-requests/${randomUUID()}`)
        .set('Cookie', customerCookie);
      expect(res.status).toBe(404);
    });
  });
});
