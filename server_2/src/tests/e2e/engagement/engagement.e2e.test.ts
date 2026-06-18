// Engagement API e2e (Phase 5) — black-box over the real HTTP API (supertest + createApp)
// against MongoMemoryReplSet (tests/setup.ts) + a disposable Redis.
//
// Exercises the happy paths from engagement_module.md §5/Phase 5:
//   update preferences -> get preferences reflects it
//   seed notification -> list history -> mark read -> unread count drops
//   seed review eligibility -> submit review -> public rating zeroed pre-approval
//   admin approves -> rating updated; admin rejects a second review -> rating unaffected
import { generateKeyPairSync, randomUUID } from 'crypto';
import request from 'supertest';
import type { Express } from 'express';

import { bootstrap, shutdown, AppContainer } from '../../../container';
import { createApp } from '../../../app';
import { connectDB } from '../../../infrastructure/database/connection';
import { getTestMongoUri } from '../../setup';
import { startRedisContainer, StartedTestRedis } from '../../integration/redis/redis-container';
import { Admin } from '../../../domain/identity/entities/Admin';
import { Notification } from '../../../domain/engagement/entities/Notification';
import { NOTIFICATION_CATEGORY } from '../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../domain/engagement/enums/notification-channel.enum';

jest.setTimeout(180000);

const ORIGINAL_ENV = { ...process.env };

function extractCookie(res: request.Response, name: string): string {
  const setCookie = (res.headers['set-cookie'] ?? []) as unknown as string[];
  const found = setCookie.find((c) => c.startsWith(`${name}=`));
  if (!found) throw new Error(`cookie "${name}" not found in response`);
  return found.split(';')[0];
}

describe('Engagement API e2e (Phase 5)', () => {
  let app: AppContainer;
  let redis: StartedTestRedis;
  let server: Express;
  let agent: ReturnType<typeof request>;

  let customerId: string;
  let customerCookie: string;
  let adminCookie: string;

  const customerEmail = `customer.${randomUUID().slice(0, 8)}@example.com`;
  const customerPassword = 'Str0ng!Pass1';
  const restaurantId = `rest-${randomUUID().slice(0, 8)}`;

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

    const reg = await agent.post('/api/v1/auth/register').send({
      role: 'CUSTOMER',
      customer: { name: 'Engagement Customer', email: customerEmail, phone: '+14155550111', password: customerPassword },
    });
    expect(reg.status).toBe(201);
    customerId = reg.body.user.id;

    const login = await agent.post('/api/v1/auth/login').send({ email: customerEmail, password: customerPassword });
    expect(login.status).toBe(200);
    customerCookie = extractCookie(login, 'access_token');

    const adminEmail = `admin.${randomUUID().slice(0, 8)}@example.com`;
    const adminPassword = 'AdminStr0ng!1';
    const passwordHash = await app.auth.passwordHasher.hash(adminPassword);
    const admin = Admin.create({
      name: 'Engagement Admin',
      email: adminEmail,
      phone: '+14155550112',
      passwordHash,
      department: 'ops',
      permissions: [],
    });
    await app.identity.userRepository.save(admin);

    const adminLogin = await agent.post('/api/v1/auth/login').send({ email: adminEmail, password: adminPassword });
    expect(adminLogin.status).toBe(200);
    adminCookie = extractCookie(adminLogin, 'access_token');
  });

  afterAll(async () => {
    if (app) {
      await shutdown(app);
      await connectDB(getTestMongoUri());
    }
    if (redis) await redis.container.stop();
    process.env = { ...ORIGINAL_ENV };
  });

  // ── Notification preferences ────────────────────────────────────────────

  it('returns default-allow preferences for a user with none set', async () => {
    const res = await agent.get('/api/v1/me/notification-preferences').set('Cookie', customerCookie);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(customerId);
    expect(res.body.channels.PROMOTIONS.email).toBe(false);
  });

  it('updates a preference channel and the change is reflected on read', async () => {
    const update = await agent
      .put('/api/v1/me/notification-preferences')
      .set('Cookie', customerCookie)
      .send({ changes: [{ category: 'ORDER_UPDATES', channel: 'EMAIL', enabled: false }] });
    expect(update.status).toBe(200);
    expect(update.body.channels.ORDER_UPDATES.email).toBe(false);

    const get = await agent.get('/api/v1/me/notification-preferences').set('Cookie', customerCookie);
    expect(get.status).toBe(200);
    expect(get.body.channels.ORDER_UPDATES.email).toBe(false);
  });

  // ── Notification history / read / unread count ──────────────────────────

  let notificationId: string;

  it('lists a seeded notification in history with an accurate unread count', async () => {
    const notification = Notification.queue({
      recipientUserId: customerId,
      category: NOTIFICATION_CATEGORY.ORDER_UPDATES,
      channel: NOTIFICATION_CHANNEL.PUSH,
      templateKey: 'order_confirmed',
      renderedTitle: 'Order confirmed',
      renderedBody: 'Your order has been confirmed.',
      dedupeKey: `e2e-${randomUUID()}:ORDER_UPDATES`,
    }).getValue();
    notification.markSent('test-provider');
    await app.engagement.notificationRepository.save(notification);
    notificationId = notification.id.toString();

    const history = await agent.get('/api/v1/me/notifications').set('Cookie', customerCookie);
    expect(history.status).toBe(200);
    expect(history.body.some((n: { notificationId: string }) => n.notificationId === notificationId)).toBe(true);

    const unread = await agent.get('/api/v1/me/notifications/unread-count').set('Cookie', customerCookie);
    expect(unread.status).toBe(200);
    expect(unread.body.count).toBeGreaterThanOrEqual(1);
  });

  it('marks the notification read and the unread count drops', async () => {
    const before = await agent.get('/api/v1/me/notifications/unread-count').set('Cookie', customerCookie);
    const beforeCount = before.body.count;

    const read = await agent
      .patch(`/api/v1/me/notifications/${notificationId}/read`)
      .set('Cookie', customerCookie);
    expect(read.status).toBe(200);
    expect(read.body.status).toBe('READ');

    const after = await agent.get('/api/v1/me/notifications/unread-count').set('Cookie', customerCookie);
    expect(after.body.count).toBe(beforeCount - 1);
  });

  // ── Reviews + rating ──────────────────────────────────────────────────

  it('returns a zeroed rating for a restaurant with no approved reviews', async () => {
    const res = await agent.get(`/api/v1/restaurants/${restaurantId}/rating`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      restaurantId,
      avgRating: 0,
      reviewCount: 0,
      distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    });
  });

  let approvedReviewId: string;
  const approvedFulfillmentId = `ful-${randomUUID().slice(0, 8)}`;

  it('submits a review once eligibility is seeded as delivered', async () => {
    await app.engagement.eligibilityRepository.upsert({
      fulfillmentId: approvedFulfillmentId,
      customerId,
      restaurantId,
      deliveredAt: new Date(),
      reviewed: false,
    });

    const res = await agent
      .post(`/api/v1/restaurants/${restaurantId}/reviews`)
      .set('Cookie', customerCookie)
      .send({ fulfillmentId: approvedFulfillmentId, restaurantRating: 5, deliveryRating: 4, comment: 'Great food' });

    expect(res.status).toBe(201);
    expect(res.body.moderationStatus).toBe('PENDING');
    approvedReviewId = res.body.reviewId;

    const mine = await agent.get('/api/v1/me/reviews').set('Cookie', customerCookie);
    expect(mine.status).toBe(200);
    expect(mine.body.some((r: { reviewId: string }) => r.reviewId === approvedReviewId)).toBe(true);
  });

  it('admin approves the review and the public rating updates', async () => {
    const approve = await agent
      .post(`/api/v1/admin/reviews/${approvedReviewId}/approve`)
      .set('Cookie', adminCookie)
      .send({});
    expect(approve.status).toBe(200);
    expect(approve.body.moderationStatus).toBe('APPROVED');

    const rating = await agent.get(`/api/v1/restaurants/${restaurantId}/rating`);
    expect(rating.status).toBe(200);
    expect(rating.body.reviewCount).toBe(1);
    expect(rating.body.avgRating).toBe(5);

    const restaurantReviews = await agent.get(`/api/v1/restaurants/${restaurantId}/reviews`);
    expect(restaurantReviews.status).toBe(200);
    expect(restaurantReviews.body.some((r: { reviewId: string }) => r.reviewId === approvedReviewId)).toBe(true);
  });

  const rejectedFulfillmentId = `ful-${randomUUID().slice(0, 8)}`;
  let rejectedReviewId: string;

  it('admin rejects a second review and the rating is unaffected', async () => {
    await app.engagement.eligibilityRepository.upsert({
      fulfillmentId: rejectedFulfillmentId,
      customerId,
      restaurantId,
      deliveredAt: new Date(),
      reviewed: false,
    });

    const submit = await agent
      .post(`/api/v1/restaurants/${restaurantId}/reviews`)
      .set('Cookie', customerCookie)
      .send({ fulfillmentId: rejectedFulfillmentId, restaurantRating: 1, comment: 'spam' });
    expect(submit.status).toBe(201);
    rejectedReviewId = submit.body.reviewId;

    const reject = await agent
      .post(`/api/v1/admin/reviews/${rejectedReviewId}/reject`)
      .set('Cookie', adminCookie)
      .send({ reason: 'spam' });
    expect(reject.status).toBe(200);
    expect(reject.body.moderationStatus).toBe('REJECTED');

    const rating = await agent.get(`/api/v1/restaurants/${restaurantId}/rating`);
    expect(rating.body.reviewCount).toBe(1);
    expect(rating.body.avgRating).toBe(5);
  });

  it('lists pending/auto-flagged reviews for the admin moderation queue', async () => {
    const flaggedFulfillmentId = `ful-${randomUUID().slice(0, 8)}`;
    await app.engagement.eligibilityRepository.upsert({
      fulfillmentId: flaggedFulfillmentId,
      customerId,
      restaurantId,
      deliveredAt: new Date(),
      reviewed: false,
    });
    const submit = await agent
      .post(`/api/v1/restaurants/${restaurantId}/reviews`)
      .set('Cookie', customerCookie)
      .send({ fulfillmentId: flaggedFulfillmentId, restaurantRating: 3 });
    expect(submit.status).toBe(201);

    const pending = await agent.get('/api/v1/admin/reviews').set('Cookie', adminCookie);
    expect(pending.status).toBe(200);
    expect(pending.body.some((r: { reviewId: string }) => r.reviewId === submit.body.reviewId)).toBe(true);
  });

  it('rejects review submission from a non-customer or unauthenticated caller', async () => {
    const unauth = await agent
      .post(`/api/v1/restaurants/${restaurantId}/reviews`)
      .send({ fulfillmentId: 'whatever', restaurantRating: 5 });
    expect(unauth.status).toBe(401);

    const wrongRole = await agent
      .post(`/api/v1/restaurants/${restaurantId}/reviews`)
      .set('Cookie', adminCookie)
      .send({ fulfillmentId: 'whatever', restaurantRating: 5 });
    expect(wrongRole.status).toBe(403);
  });
});
