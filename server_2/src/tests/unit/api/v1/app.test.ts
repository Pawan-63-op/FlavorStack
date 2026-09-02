import request from 'supertest';
import { createApp } from '../../../../app';
import { AppContainer } from '../../../../container';
import { Result } from '../../../../domain/shared/Result';
import { USER_ROLE } from '../../../../domain/identity/enums/user-role.enum';
import { ACCESS_TOKEN_COOKIE } from '../../../../api/v1/http/cookies';
import { AuthResponse } from '../../../../application/identity/responses/AuthResponse';
import { UserResponse } from '../../../../application/identity/responses/UserResponse';
import { TokenPayLoad } from '../../../../domain/identity/value-objects/TokenPayLoad.vo';

function mockUseCase() {
  return { execute: jest.fn() };
}

function buildFakeApp() {
  const useCases = {
    registerUser: mockUseCase(),
    login: mockUseCase(),
    refreshToken: mockUseCase(),
    logout: mockUseCase(),
    logoutAllSessions: mockUseCase(),
    getActiveSessions: mockUseCase(),
    forgotPassword: mockUseCase(),
    resetPassword: mockUseCase(),
    changePassword: mockUseCase(),
    sendEmailOtp: mockUseCase(),
    verifyEmail: mockUseCase(),
    sendPhoneOtp: mockUseCase(),
    verifyPhoneOtp: mockUseCase(),
    getProfile: mockUseCase(),
    updateProfile: mockUseCase(),
    assignRole: mockUseCase(),
    grantPermission: mockUseCase(),
    banUser: mockUseCase(),
    unbanUser: mockUseCase(),
  };

  const tokenService = {
    generateAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(),
    verify: jest.fn(),
    decode: jest.fn(),
  };

  const rateLimiter = {
    check: jest.fn().mockResolvedValue({ allowed: true, retryAfter: 0 }),
  };

  const rbacService = {
    can: jest.fn(),
    hasRole: jest.fn(),
    authorize: jest.fn(),
  };

  const userRepository = {
    findById: jest.fn(),
  };

  const catalogWrite = {
    commands: {
      createRestaurant: mockUseCase(),
      updateRestaurant: mockUseCase(),
      publishRestaurant: mockUseCase(),
      pauseRestaurant: mockUseCase(),
      closeRestaurant: mockUseCase(),
      deleteRestaurant: mockUseCase(),
      setRestaurantVisibility: mockUseCase(),
      setOpeningHours: mockUseCase(),
      addCategory: mockUseCase(),
      updateCategory: mockUseCase(),
      reorderCategories: mockUseCase(),
      removeCategory: mockUseCase(),
      manageDeliveryZone: mockUseCase(),
      addMenuItem: mockUseCase(),
      updateMenuItem: mockUseCase(),
      toggleMenuItemAvailability: mockUseCase(),
      removeMenuItem: mockUseCase(),
      setItemVariants: mockUseCase(),
    },
    imageStorage: { upload: jest.fn(), delete: jest.fn() },
  };
  const catalogRead = {
    queries: {
      getRestaurant: mockUseCase(),
      listRestaurants: mockUseCase(),
      getRestaurantMenu: mockUseCase(),
      getMenuItem: mockUseCase(),
      getItemsSnapshot: mockUseCase(),
      checkServiceability: mockUseCase(),
      searchRestaurants: mockUseCase(),
      searchMenuItems: mockUseCase(),
      getNearbyRestaurants: mockUseCase(),
    },
  };

  const commerce = {
    commands: {
      createCart: mockUseCase(),
      getCart: mockUseCase(),
      addToCart: mockUseCase(),
      removeFromCart: mockUseCase(),
      updateCartItem: mockUseCase(),
      clearCart: mockUseCase(),
    },
  };

  const fulfillment = {
    acceptDelivery: mockUseCase(),
    cancelFulfillment: mockUseCase(),
    completeDelivery: mockUseCase(),
    confirmPickup: mockUseCase(),
    failDelivery: mockUseCase(),
    getAdminDashboard: mockUseCase(),
    getDashboardAnalytics: mockUseCase(),
    getLiveTracking: mockUseCase(),
    getRestaurantFulfillments: mockUseCase(),
    getRiderDeliveryHistory: mockUseCase(),
    getRiderQueue: mockUseCase(),
    listCustomerOrders: mockUseCase(),
    markPreparing: mockUseCase(),
    markReadyForPickup: mockUseCase(),
    reassignRider: mockUseCase(),
    recordRiderLocation: mockUseCase(),
    rejectDelivery: mockUseCase(),
    startDelivery: mockUseCase(),
  };

  const engagement = {
    getMyReviews: mockUseCase(),
    getNotificationHistory: mockUseCase(),
    getNotificationPreferences: mockUseCase(),
    getRestaurantRating: mockUseCase(),
    getRestaurantReviews: mockUseCase(),
    getUnreadCount: mockUseCase(),
    listPendingReviews: mockUseCase(),
    markNotificationRead: mockUseCase(),
    moderateReview: mockUseCase(),
    submitReview: mockUseCase(),
    updateNotificationPreferences: mockUseCase(),
  };

  // `/health` probes these two directly off the container — see health.routes.ts.
  const command = jest.fn().mockResolvedValue({ ok: 1 });
  const connection = { db: { admin: () => ({ command }) } };
  const redisClient = { ping: jest.fn().mockResolvedValue(true) };

  const app = {
    identity: { userRepository },
    auth: { tokenService, rateLimiter, rbacService },
    useCases,
    catalogWrite,
    catalogRead,
    commerce,
    fulfillment,
    engagement,
    connection,
    redisClient,
  } as unknown as AppContainer;

  return { app, useCases, tokenService, rateLimiter, userRepository, command, redisClient };
}

const AUTH_RESPONSE: AuthResponse = {
  user: {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: USER_ROLE.CUSTOMER,
    isEmailVerified: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  accessToken: 'access-token-value',
  refreshToken: 'refresh-token-value',
  expiresIn: 900,
};

const USER_RESPONSE: UserResponse = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: USER_ROLE.CUSTOMER,
  isEmailVerified: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const TOKEN_PAYLOAD: TokenPayLoad = {
  userId: 'user-1',
  role: USER_ROLE.CUSTOMER,
  sessionId: 'session-1',
  jti: 'jti-1',
  tokenVersion: 0,
  iat: 0,
  exp: 0,
};

describe('createApp', () => {
  it('mounts without throwing', () => {
    const { app } = buildFakeApp();
    expect(() => createApp(app)).not.toThrow();
  });

  it('returns a structured 404 for unknown routes', async () => {
    const { app } = buildFakeApp();
    const expressApp = createApp(app);

    const res = await request(expressApp).get('/api/v1/unknown');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND' });
    expect(res.body.error.requestId).toBeTruthy();
  });

  it('does not mount health under the versioned API — it lives at the root', async () => {
    const { app } = buildFakeApp();
    const expressApp = createApp(app);

    const res = await request(expressApp).get('/api/v1/health');

    expect(res.status).toBe(404);
  });

  it('serves GET /health with both dependency checks ok', async () => {
    const { app } = buildFakeApp();
    const expressApp = createApp(app);

    const res = await request(expressApp).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', checks: { mongo: true, redis: true } });
    expect(typeof res.body.uptimeSeconds).toBe('number');
  });

  it('returns 503 from /health with the same body shape when a dependency is down', async () => {
    const { app, redisClient } = buildFakeApp();
    redisClient.ping.mockResolvedValue(false);
    const expressApp = createApp(app);

    const res = await request(expressApp).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.checks).toEqual({ mongo: true, redis: false });
  });

  it('serves GET /metrics as Prometheus text', async () => {
    const { app } = buildFakeApp();
    const expressApp = createApp(app);

    const res = await request(expressApp).get('/metrics');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
  });

  it('rejects an invalid login body with 422 VALIDATION_ERROR', async () => {
    const { app } = buildFakeApp();
    const expressApp = createApp(app);

    const res = await request(expressApp).post('/api/v1/auth/login').send({ email: 'not-an-email' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('logs in with a valid body and sets auth cookies', async () => {
    const { app, useCases } = buildFakeApp();
    useCases.login.execute.mockResolvedValue(Result.ok(AUTH_RESPONSE));
    const expressApp = createApp(app);

    const res = await request(expressApp)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe(AUTH_RESPONSE.accessToken);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('access_token='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(true);
  });

  it('rejects /users/me with no token (401)', async () => {
    const { app } = buildFakeApp();
    const expressApp = createApp(app);

    const res = await request(expressApp).get('/api/v1/users/me');

    expect(res.status).toBe(401);
  });

  it('returns the profile for /users/me with a valid token', async () => {
    const { app, useCases, tokenService } = buildFakeApp();
    tokenService.verify.mockReturnValue(Result.ok(TOKEN_PAYLOAD));
    useCases.getProfile.execute.mockResolvedValue(Result.ok(USER_RESPONSE));
    const expressApp = createApp(app);

    const res = await request(expressApp)
      .get('/api/v1/users/me')
      .set('Cookie', [`${ACCESS_TOKEN_COOKIE}=valid-token`]);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(USER_RESPONSE.id);
    expect(useCases.getProfile.execute).toHaveBeenCalledWith({ userId: TOKEN_PAYLOAD.userId });
  });

  it('rejects admin routes for a non-admin role (403)', async () => {
    const { app, tokenService } = buildFakeApp();
    tokenService.verify.mockReturnValue(Result.ok(TOKEN_PAYLOAD));
    const expressApp = createApp(app);

    const res = await request(expressApp)
      .post('/api/v1/admin/users/507f1f77bcf86cd799439011/ban')
      .set('Cookie', [`${ACCESS_TOKEN_COOKIE}=valid-token`])
      .send({ reason: 'fraud' });

    expect(res.status).toBe(403);
  });
});
