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

describe('Catalog API e2e (Phase 11)', () => {
  let app: AppContainer;
  let redis: StartedTestRedis;
  let server: Express;
  let agent: ReturnType<typeof request>;

  let ownerCookie: string;
  let strangerCookie: string;

  let restaurantId: string;
  let categoryId: string;
  let itemId: string;

  const slug = `e2e-diner-${randomUUID().slice(0, 8)}`;
  const LAT = 18.5204;
  const LNG = 73.8567;

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

    ownerCookie = await registerAndLogin(`owner.${slug}@example.com`, '+14155550123');
    strangerCookie = await registerAndLogin(`stranger.${slug}@example.com`, '+14155550987');
  });

  afterAll(async () => {
    if (app) {
      await shutdown(app);
      await connectDB(getTestMongoUri());
    }
    if (redis) await redis.container.stop();
    process.env = { ...ORIGINAL_ENV };
  });


  it('rejects an unauthenticated create (401)', async () => {
    const res = await agent.post('/api/v1/catalog/restaurants').send({
      name: 'E2E Diner',
      cuisineTypes: ['NORTH_INDIAN'],
      address: {
        street: '1 St',
        city: 'Pune',
        state: 'MH',
        pinCode: '411001',
        coordinates: { lat: LAT, lng: LNG },
      },
      location: { lat: LAT, lng: LNG },
      phone: '+919812345678',
    });
    expect(res.status).toBe(401);
  });

  it('owner creates a restaurant (201, DRAFT/HIDDEN)', async () => {
    const res = await agent
      .post('/api/v1/catalog/restaurants')
      .set('Cookie', ownerCookie)
      .send({
        name: 'E2E Diner',
        slug,
        description: 'Tasty e2e food',
        cuisineTypes: ['NORTH_INDIAN'],
        address: {
          label: 'Main',
          street: '1 St',
          city: 'Pune',
          state: 'MH',
          pinCode: '411001',
          coordinates: { lat: LAT, lng: LNG },
        },
        location: { lat: LAT, lng: LNG },
        phone: '+919812345678',
      });

    expect(res.status).toBe(201);
    expect(res.body.slug).toBe(slug);
    expect(res.body.status).toBe('DRAFT');
    restaurantId = res.body.id;
  });

  it('rejects an invalid create body (422)', async () => {
    const res = await agent
      .post('/api/v1/catalog/restaurants')
      .set('Cookie', ownerCookie)
      .send({ name: '', cuisineTypes: [] });
    expect(res.status).toBe(422);
  });

  it('owner adds a category (201)', async () => {
    const res = await agent
      .post(`/api/v1/catalog/restaurants/${restaurantId}/categories`)
      .set('Cookie', ownerCookie)
      .send({ label: 'Starters', sortOrder: 0 });

    expect(res.status).toBe(201);
    expect(res.body.categories).toHaveLength(1);
    categoryId = res.body.categories[0].id;
  });

  it('owner adds a menu item (201)', async () => {
    const res = await agent
      .post(`/api/v1/catalog/restaurants/${restaurantId}/items`)
      .set('Cookie', ownerCookie)
      .send({
        categoryId,
        name: 'Paneer Tikka',
        description: 'Grilled cottage cheese',
        basePrice: { amount: 25000 },
        tags: ['spicy', 'popular'],
        dietary: ['VEG'],
      });

    expect(res.status).toBe(201);
    expect(res.body.basePrice.amount).toBe(25000);
    itemId = res.body.id;
  });

  it('rejects a non-owner write (403)', async () => {
    const res = await agent
      .post(`/api/v1/catalog/restaurants/${restaurantId}/categories`)
      .set('Cookie', strangerCookie)
      .send({ label: 'Hijack' });
    expect(res.status).toBe(403);
  });

  it('owner publishes the restaurant then makes it public', async () => {
    const pub = await agent
      .post(`/api/v1/catalog/restaurants/${restaurantId}/publish`)
      .set('Cookie', ownerCookie);
    expect(pub.status).toBe(200);
    expect(pub.body.status).toBe('ACTIVE');

    const vis = await agent
      .patch(`/api/v1/catalog/restaurants/${restaurantId}/visibility`)
      .set('Cookie', ownerCookie)
      .send({ visibility: 'PUBLIC' });
    expect(vis.status).toBe(200);
    expect(vis.body.visibility).toBe('PUBLIC');
  });


  it('public list includes the published restaurant', async () => {
    const res = await agent.get('/api/v1/catalog/restaurants');
    expect(res.status).toBe(200);
    const ids = res.body.items.map((r: { id: string }) => r.id);
    expect(ids).toContain(restaurantId);
  });

  it('public detail + menu return the restaurant and its item', async () => {
    const detail = await agent.get(`/api/v1/catalog/restaurants/${restaurantId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.slug).toBe(slug);

    const menu = await agent.get(`/api/v1/catalog/restaurants/${restaurantId}/menu`);
    expect(menu.status).toBe(200);
    expect(menu.body.categories[0].items[0].name).toBe('Paneer Tikka');
  });

  it('public item read returns the menu item', async () => {
    const res = await agent.get(`/api/v1/catalog/items/${itemId}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Paneer Tikka');
  });

  it('text search surfaces the restaurant', async () => {
    const res = await agent.get('/api/v1/catalog/search/restaurants').query({ q: 'Diner' });
    expect(res.status).toBe(200);
    const ids = res.body.items.map((r: { id: string }) => r.id);
    expect(ids).toContain(restaurantId);
  });

  it('geo nearby surfaces the restaurant', async () => {
    const res = await agent
      .get('/api/v1/catalog/nearby')
      .query({ lat: LAT, lng: LNG, radiusMeters: 5000 });
    expect(res.status).toBe(200);
    const ids = res.body.items.map((r: { id: string }) => r.id);
    expect(ids).toContain(restaurantId);
  });


  it('closing the restaurant hides it from public reads (404)', async () => {
    const close = await agent
      .post(`/api/v1/catalog/restaurants/${restaurantId}/close`)
      .set('Cookie', ownerCookie);
    expect(close.status).toBe(200);
    expect(close.body.status).toBe('CLOSED');

    const detail = await agent.get(`/api/v1/catalog/restaurants/${restaurantId}`);
    expect(detail.status).toBe(404);

    const list = await agent.get('/api/v1/catalog/restaurants');
    const ids = list.body.items.map((r: { id: string }) => r.id);
    expect(ids).not.toContain(restaurantId);
  });
});
