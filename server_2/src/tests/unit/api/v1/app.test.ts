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
    verifyEmailOtp: mockUseCase(),
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

  // Catalog graphs (Phase 11 wiring): createApiRouter constructs the catalog
  // controllers from these, so the fake container must supply them or createApp
  // throws. The controllers only store the deps, so mock use-cases suffice.
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

  // Commerce graph (Phase 4 wiring): createApiRouter constructs CartController
  // from these, so the fake container must supply them or createApp throws.
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

  const app = {
    identity: { userRepository },
    auth: { tokenService, rateLimiter, rbacService },
    useCases,
    catalogWrite,
    catalogRead,
    commerce,
  } as unknown as AppContainer;

  return { app, useCases, tokenService, rateLimiter, userRepository };
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

  it('returns 404 for unmounted /api/v1/health (controller not yet wired)', async () => {
    const { app } = buildFakeApp();
    const expressApp = createApp(app);

    const res = await request(expressApp).get('/api/v1/health');

    expect(res.status).toBe(404);
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
