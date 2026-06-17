// Phase 10, Batch 6 — black-box e2e over the real HTTP API (supertest + createApp),
// against MongoMemoryReplSet (tests/setup.ts) + a disposable Redis container.
//
// Every `it` below shares one bootstrap()'d AppContainer and runs strictly in
// declaration order (see identity_phase10.md Batch 6) — later steps depend on
// state (cookies, OTP codes, login-rate-limit counters) left by earlier ones.
import { generateKeyPairSync } from 'crypto';
import request from 'supertest';
import type { Express } from 'express';

import { bootstrap, shutdown, AppContainer } from '../../../container';
import { createApp } from '../../../app';
import { connectDB } from '../../../infrastructure/database/connection';
import { getTestMongoUri } from '../../setup';
import { startRedisContainer, StartedTestRedis } from '../../integration/redis/redis-container';
import { otpKey } from '../../../infrastructure/redis/keys';
import { passwordResetOtpKey, emailVerificationOtpKey } from '../../../application/identity/otp-keys';
import { Admin } from '../../../domain/identity/entities/Admin';
import { Permission } from '../../../domain/identity/value-objects/Permission.vo';
import { PERMISSION_RESOURCE } from '../../../domain/identity/enums/permission-resource.enum';
import { PERMISSION_ACTION } from '../../../domain/identity/enums/permission-action.enum';

jest.setTimeout(180000);

const ORIGINAL_ENV = { ...process.env };

function extractCookie(res: request.Response, name: string): string {
  const setCookie = (res.headers['set-cookie'] ?? []) as unknown as string[];
  const found = setCookie.find((c) => c.startsWith(`${name}=`));
  if (!found) throw new Error(`cookie "${name}" not found in response`);
  return found.split(';')[0];
}

describe('Identity API e2e (Phase 10, Batch 6)', () => {
  let app: AppContainer;
  let redis: StartedTestRedis;
  let server: Express;
  let agent: ReturnType<typeof request>;

  const customerEmail = 'alice.e2e@example.com';
  const customerPassword = 'Str0ng!Pass1';
  const newPassword = 'NewStr0ng!Pass2';

  let userId: string;
  let accessCookie: string;
  let refreshCookie: string;

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

    // Avoid real network calls to Resend — e2e reads OTP codes straight out of
    // Redis, it doesn't need actual email delivery.
    app.auth.emailProvider.sendVerification = jest.fn().mockResolvedValue(undefined);
    app.auth.emailProvider.sendPasswordReset = jest.fn().mockResolvedValue(undefined);
    app.auth.emailProvider.sendNotification = jest.fn().mockResolvedValue(undefined);

    server = createApp(app);
    agent = request(server);
  });

  afterAll(async () => {
    if (app) {
      await shutdown(app);
      // shutdown() disconnected Mongo; reconnect so tests/setup.ts's global
      // afterAll (disconnectDB + replSet.stop) doesn't hit a closed topology.
      await connectDB(getTestMongoUri());
    }
    if (redis) {
      await redis.container.stop();
    }
    process.env = { ...ORIGINAL_ENV };
  });

  // ── register -> login -> refresh -> logout ─────────────────────────────

  it('registers a new customer (201, AuthResponse, no auth cookies)', async () => {
    const res = await agent.post('/api/v1/auth/register').send({
      role: 'CUSTOMER',
      customer: {
        name: 'Alice Example',
        email: customerEmail,
        phone: '+14155550100',
        password: customerPassword,
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(customerEmail);
    expect(res.body.user.role).toBe('CUSTOMER');
    expect(res.body.user.isEmailVerified).toBe(false);
    expect(res.headers['set-cookie']).toBeUndefined();

    userId = res.body.user.id;
  });

  it('logs in and receives access/refresh cookies', async () => {
    const res = await agent
      .post('/api/v1/auth/login')
      .send({ email: customerEmail, password: customerPassword });

    expect(res.status).toBe(200);
    accessCookie = extractCookie(res, 'access_token');
    refreshCookie = extractCookie(res, 'refresh_token');
  });

  it('refreshes the session and rotates both cookies', async () => {
    const res = await agent.post('/api/v1/auth/refresh').set('Cookie', [refreshCookie]);

    expect(res.status).toBe(200);
    const newAccessCookie = extractCookie(res, 'access_token');
    const newRefreshCookie = extractCookie(res, 'refresh_token');
    expect(newAccessCookie).not.toEqual(accessCookie);
    expect(newRefreshCookie).not.toEqual(refreshCookie);

    accessCookie = newAccessCookie;
    refreshCookie = newRefreshCookie;
  });

  it('logs out and clears both cookies', async () => {
    const res = await agent.post('/api/v1/auth/logout').set('Cookie', [accessCookie]);

    expect(res.status).toBe(204);
    const setCookie = (res.headers['set-cookie'] ?? []) as unknown as string[];
    expect(setCookie.some((c) => c.startsWith('access_token=;'))).toBe(true);
    expect(setCookie.some((c) => c.startsWith('refresh_token=;'))).toBe(true);
  });

  // ── forgot-password -> reset-password ──────────────────────────────────

  it('requests a password reset (always 204, no enumeration)', async () => {
    const res = await agent
      .post('/api/v1/auth/forgot-password')
      .send({ email: customerEmail });

    expect(res.status).toBe(204);
  });

  it('resets the password using the OTP issued to Redis', async () => {
    const code = await app.redisClient.getClient().get(otpKey(passwordResetOtpKey(userId)));
    expect(code).toMatch(/^\d{6}$/);

    const res = await agent.post('/api/v1/auth/reset-password').send({
      email: customerEmail,
      code,
      newPassword,
    });

    expect(res.status).toBe(204);
  });

  it('rejects login with the old password and accepts the new one', async () => {
    const oldRes = await agent
      .post('/api/v1/auth/login')
      .send({ email: customerEmail, password: customerPassword });
    expect(oldRes.status).toBe(401);

    const res = await agent
      .post('/api/v1/auth/login')
      .send({ email: customerEmail, password: newPassword });
    expect(res.status).toBe(200);

    accessCookie = extractCookie(res, 'access_token');
    refreshCookie = extractCookie(res, 'refresh_token');
  });

  // ── email OTP send -> verify ────────────────────────────────────────────

  it('sends an email-verification OTP to the authenticated user', async () => {
    const res = await agent.post('/api/v1/auth/email-otp/send').set('Cookie', [accessCookie]);

    expect(res.status).toBe(204);
  });

  it('verifies the email OTP issued to Redis', async () => {
    const code = await app.redisClient.getClient().get(otpKey(emailVerificationOtpKey(userId)));
    expect(code).toMatch(/^\d{6}$/);

    const res = await agent
      .post('/api/v1/auth/email-otp/verify')
      .set('Cookie', [accessCookie])
      .send({ code });

    expect(res.status).toBe(204);
  });

  // ── admin routes: role/permission/super-admin ──────────────────────────

  it('rejects a non-admin from an admin-only route (403)', async () => {
    const res = await agent
      .post(`/api/v1/admin/users/${userId}/ban`)
      .set('Cookie', [accessCookie])
      .send({ reason: 'non-admin attempt' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows a scoped admin with users:update permission to ban the user', async () => {
    const adminEmail = 'scoped-admin.e2e@example.com';
    const adminPassword = 'AdminStr0ng!1';

    const passwordHash = await app.auth.passwordHasher.hash(adminPassword);
    const permission = Permission.create({
      resource: PERMISSION_RESOURCE.USER,
      action: PERMISSION_ACTION.UPDATE,
    }).getValue();

    const admin = Admin.create({
      name: 'Scoped Admin',
      email: adminEmail,
      phone: '+14155550101',
      passwordHash,
      department: 'ops',
      permissions: [permission],
    });
    await app.identity.userRepository.save(admin);

    const loginRes = await agent
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword });
    expect(loginRes.status).toBe(200);
    const adminCookie = extractCookie(loginRes, 'access_token');

    const banRes = await agent
      .post(`/api/v1/admin/users/${userId}/ban`)
      .set('Cookie', [adminCookie])
      .send({ reason: 'policy violation' });

    expect(banRes.status).toBe(204);
  });

  it('allows a super-admin to unban the user via the permission bypass', async () => {
    const superAdminEmail = 'super-admin.e2e@example.com';
    const superAdminPassword = 'SuperStr0ng!1';

    const passwordHash = await app.auth.passwordHasher.hash(superAdminPassword);
    const superAdmin = Admin.createSuperAdmin({
      name: 'Super Admin',
      email: superAdminEmail,
      phone: '+14155550102',
      passwordHash,
      department: 'ops',
    });
    await app.identity.userRepository.save(superAdmin);

    const loginRes = await agent
      .post('/api/v1/auth/login')
      .send({ email: superAdminEmail, password: superAdminPassword });
    expect(loginRes.status).toBe(200);
    const superCookie = extractCookie(loginRes, 'access_token');

    const unbanRes = await agent
      .post(`/api/v1/admin/users/${userId}/unban`)
      .set('Cookie', [superCookie]);

    expect(unbanRes.status).toBe(204);
  });

  // ── rate limiting ────────────────────────────────────────────────────────

  it('blocks /auth/login with 429 once the per-IP rate limit is exhausted', async () => {
    // DEFAULT_RATE_LIMITS.login = { windowSeconds: 900, max: 5 }, keyed by req.context.ip
    // since /auth/login is unauthenticated. By this point the suite has already made
    // exactly 5 /auth/login requests (initial login, old/new password after reset,
    // scoped-admin login, super-admin login) — all from the same supertest agent IP —
    // so this 6th request is the one that trips the limiter.
    const res = await agent
      .post('/api/v1/auth/login')
      .send({ email: customerEmail, password: newPassword });

    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
    expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
