// Commerce Cart API e2e (Phase 4) — black-box over the real HTTP API (supertest +
// createApp) against MongoMemoryReplSet (tests/setup.ts) + a disposable Redis.
//
// Exercises the cart lifecycle end to end:
//   unauthenticated access rejected (401)
//   GET /cart before any items -> 404 (no active cart yet)
//   POST /cart/items -> creates cart, adds item (200)
//   POST /cart/items with same selection -> merges quantity
//   POST /cart/items from a different restaurant -> 409 (single-restaurant invariant)
//   PATCH /cart/items/:itemId -> updates quantity
//   PATCH /cart/items/:itemId with quantity 0 -> removes the line
//   DELETE /cart/items/:itemId -> removes a line item (404 for unknown id)
//   DELETE /cart -> clears the cart
//   GET /cart/summary -> empty summary before any item, count+subtotal after (Phase 13)
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

describe('Commerce Cart API e2e (Phase 4)', () => {
  let app: AppContainer;
  let redis: StartedTestRedis;
  let server: Express;
  let agent: ReturnType<typeof request>;

  let customerCookie: string;

  const slug = `e2e-cart-${randomUUID().slice(0, 8)}`;
  const restaurantId = randomUUID();
  const menuItemId = randomUUID();
  const otherRestaurantId = randomUUID();
  const otherMenuItemId = randomUUID();

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

  it('rejects unauthenticated access to the cart (401)', async () => {
    const res = await agent.get('/api/v1/cart');
    expect(res.status).toBe(401);
  });

  it('returns 404 for GetCart before any item has been added', async () => {
    const res = await agent.get('/api/v1/cart').set('Cookie', customerCookie);
    expect(res.status).toBe(404);
  });

  it('rejects unauthenticated access to the cart summary (401)', async () => {
    const res = await agent.get('/api/v1/cart/summary');
    expect(res.status).toBe(401);
  });

  it('returns an empty cart summary (200) before any item has been added', async () => {
    const res = await agent.get('/api/v1/cart/summary').set('Cookie', customerCookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ cartId: null, itemCount: 0, total: null, currency: null });
  });

  it('rejects an invalid AddToCart payload (422)', async () => {
    const res = await agent
      .post('/api/v1/cart/items')
      .set('Cookie', customerCookie)
      .send({ restaurantId, menuItemId, quantity: 0, unitPrice: { amount: 15000 } });
    expect(res.status).toBe(422);
  });

  let cartItemId: string;

  it('adds an item to the cart, creating it (200)', async () => {
    const res = await agent
      .post('/api/v1/cart/items')
      .set('Cookie', customerCookie)
      .send({ restaurantId, menuItemId, quantity: 2, unitPrice: { amount: 15000, currency: 'INR' } });

    expect(res.status).toBe(200);
    expect(res.body.restaurantId).toBe(restaurantId);
    expect(res.body.currency).toBe('INR');
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(2);
    cartItemId = res.body.items[0].id;
  });

  it('GetCart returns the cart with the added item', async () => {
    const res = await agent.get('/api/v1/cart').set('Cookie', customerCookie);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe(cartItemId);
  });

  it('merges an identical line into the existing cart item (quantity increases)', async () => {
    const res = await agent
      .post('/api/v1/cart/items')
      .set('Cookie', customerCookie)
      .send({ restaurantId, menuItemId, quantity: 1, unitPrice: { amount: 15000, currency: 'INR' } });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe(cartItemId);
    expect(res.body.items[0].quantity).toBe(3);
  });

  it('cart summary reflects item count and subtotal (200)', async () => {
    const res = await agent.get('/api/v1/cart/summary').set('Cookie', customerCookie);
    expect(res.status).toBe(200);
    expect(res.body.itemCount).toBe(3);
    expect(res.body.total).toEqual({ amount: 45000, currency: 'INR' });
    expect(res.body.currency).toBe('INR');
  });

  it('rejects adding an item from a different restaurant (409)', async () => {
    const res = await agent
      .post('/api/v1/cart/items')
      .set('Cookie', customerCookie)
      .send({
        restaurantId: otherRestaurantId,
        menuItemId: otherMenuItemId,
        quantity: 1,
        unitPrice: { amount: 5000, currency: 'INR' },
      });

    expect(res.status).toBe(409);
  });

  it('updates the quantity of a line item (200)', async () => {
    const res = await agent
      .patch(`/api/v1/cart/items/${cartItemId}`)
      .set('Cookie', customerCookie)
      .send({ quantity: 5 });

    expect(res.status).toBe(200);
    expect(res.body.items[0].quantity).toBe(5);
  });

  it('removes the line item when quantity is set to 0 (200)', async () => {
    const res = await agent
      .patch(`/api/v1/cart/items/${cartItemId}`)
      .set('Cookie', customerCookie)
      .send({ quantity: 0 });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
    expect(res.body.restaurantId).toBeNull();
    expect(res.body.currency).toBeNull();
  });

  it('returns 404 for RemoveFromCart with an unknown item id', async () => {
    const res = await agent
      .delete(`/api/v1/cart/items/${randomUUID()}`)
      .set('Cookie', customerCookie);

    expect(res.status).toBe(404);
  });

  it('re-adds an item then removes it via DELETE (200)', async () => {
    const addRes = await agent
      .post('/api/v1/cart/items')
      .set('Cookie', customerCookie)
      .send({ restaurantId, menuItemId, quantity: 1, unitPrice: { amount: 15000, currency: 'INR' } });
    expect(addRes.status).toBe(200);
    const itemId = addRes.body.items[0].id;

    const res = await agent
      .delete(`/api/v1/cart/items/${itemId}`)
      .set('Cookie', customerCookie);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });

  it('clears the cart (200)', async () => {
    await agent
      .post('/api/v1/cart/items')
      .set('Cookie', customerCookie)
      .send({ restaurantId, menuItemId, quantity: 1, unitPrice: { amount: 15000, currency: 'INR' } });

    const res = await agent.delete('/api/v1/cart').set('Cookie', customerCookie);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
    expect(res.body.restaurantId).toBeNull();
    expect(res.body.currency).toBeNull();
  });
});
