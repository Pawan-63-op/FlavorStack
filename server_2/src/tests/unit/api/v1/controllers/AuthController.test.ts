import { Request, Response, NextFunction } from 'express';
import { AuthController, AuthControllerDeps } from '../../../../../api/v1/controllers/AuthController';
import { Result } from '../../../../../domain/shared/Result';
import { NotFoundError } from '../../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../../domain/shared/errors/ForbiddenError';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../../../../../api/v1/http/cookies';
import { AuthResponse } from '../../../../../application/identity/responses/AuthResponse';
import { SessionResponse } from '../../../../../application/identity/responses/SessionResponse';
import { USER_ROLE } from '../../../../../domain/identity/enums/user-role.enum';

function mockUseCase() {
  return { execute: jest.fn() };
}

function buildDeps() {
  return {
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
  };
}

function mockRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    cookies: {},
    context: { requestId: 'req-1', ip: '127.0.0.1', userAgent: 'jest-agent', device: 'test-device' },
    ...overrides,
  } as unknown as Request;
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
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresIn: 900,
};

const AUTH_USER = {
  userId: 'user-1',
  role: USER_ROLE.CUSTOMER,
  sessionId: 'session-1',
  jti: 'jti-1',
  tokenVersion: 0,
};

describe('AuthController', () => {
  let deps: ReturnType<typeof buildDeps>;
  let controller: AuthController;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    deps = buildDeps();
    controller = new AuthController(deps as unknown as AuthControllerDeps);
    res = mockRes();
    next = jest.fn();
  });

  describe('register', () => {
    it('calls registerUser with the validated body and returns 201 with no cookies set', async () => {
      deps.registerUser.execute.mockResolvedValue(Result.ok(AUTH_RESPONSE));
      const body = { role: USER_ROLE.CUSTOMER, customer: { name: 'Test User' } };
      const req = mockReq({ body });

      await controller.register(req, res, next);

      expect(deps.registerUser.execute).toHaveBeenCalledWith(body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(AUTH_RESPONSE);
      expect(res.cookie).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards the error to next on failure', async () => {
      const error = new NotFoundError('user_not_found');
      deps.registerUser.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({ body: { role: USER_ROLE.CUSTOMER } });

      await controller.register(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('builds the LoginDto with device context, sets cookies, and returns 200', async () => {
      deps.login.execute.mockResolvedValue(Result.ok(AUTH_RESPONSE));
      const req = mockReq({ body: { email: 'test@example.com', password: 'Passw0rd!' } });

      await controller.login(req, res, next);

      expect(deps.login.execute).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Passw0rd!',
        device: 'test-device',
        ip: '127.0.0.1',
        userAgent: 'jest-agent',
      });
      expect(res.cookie).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE, 'access-token', expect.any(Object));
      expect(res.cookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE, 'refresh-token', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(AUTH_RESPONSE);
    });

    it('forwards the error to next on failure without setting cookies', async () => {
      const error = new ForbiddenError('invalid_credentials');
      deps.login.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({ body: { email: 'test@example.com', password: 'wrong' } });

      await controller.login(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('reads the refresh_token cookie, rotates cookies, and returns 200', async () => {
      deps.refreshToken.execute.mockResolvedValue(Result.ok(AUTH_RESPONSE));
      const req = mockReq({ cookies: { [REFRESH_TOKEN_COOKIE]: 'old-refresh-token' } });

      await controller.refresh(req, res, next);

      expect(deps.refreshToken.execute).toHaveBeenCalledWith({
        refreshToken: 'old-refresh-token',
        device: 'test-device',
        ip: '127.0.0.1',
        userAgent: 'jest-agent',
      });
      expect(res.cookie).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE, 'access-token', expect.any(Object));
      expect(res.cookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE, 'refresh-token', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(AUTH_RESPONSE);
    });

    it('forwards ForbiddenError(invalid_token) to next when no refresh cookie is present', async () => {
      const req = mockReq({ cookies: {} });

      await controller.refresh(req, res, next);

      expect(deps.refreshToken.execute).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
      expect((next as jest.Mock).mock.calls[0][0].message).toBe('invalid_token');
    });

    it('forwards the error to next on use-case failure', async () => {
      const error = new ForbiddenError('token_reuse_detected');
      deps.refreshToken.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({ cookies: { [REFRESH_TOKEN_COOKIE]: 'reused-token' } });

      await controller.refresh(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('logs out the current session, clears cookies, and returns 204', async () => {
      deps.logout.execute.mockResolvedValue(Result.ok());
      const req = mockReq({ user: AUTH_USER });

      await controller.logout(req, res, next);

      expect(deps.logout.execute).toHaveBeenCalledWith({ userId: 'user-1', sessionId: 'session-1' });
      expect(res.clearCookie).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE, expect.any(Object));
      expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE, expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('forwards the error to next on failure', async () => {
      const error = new NotFoundError('user_not_found');
      deps.logout.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({ user: AUTH_USER });

      await controller.logout(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.clearCookie).not.toHaveBeenCalled();
    });
  });

  describe('logoutAll', () => {
    it('logs out all sessions, clears cookies, and returns 204', async () => {
      deps.logoutAllSessions.execute.mockResolvedValue(Result.ok());
      const req = mockReq({ user: AUTH_USER });

      await controller.logoutAll(req, res, next);

      expect(deps.logoutAllSessions.execute).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(res.clearCookie).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE, expect.any(Object));
      expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE, expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('forwards the error to next on failure', async () => {
      const error = new NotFoundError('user_not_found');
      deps.logoutAllSessions.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({ user: AUTH_USER });

      await controller.logoutAll(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.clearCookie).not.toHaveBeenCalled();
    });
  });

  describe('listSessions', () => {
    it('returns 200 with the active sessions for the current user', async () => {
      const sessions: SessionResponse[] = [
        { sessionId: 'session-1', device: 'test-device', ip: '127.0.0.1', createdAt: new Date(), expiresAt: new Date() },
      ];
      deps.getActiveSessions.execute.mockResolvedValue(Result.ok(sessions));
      const req = mockReq({ user: AUTH_USER });

      await controller.listSessions(req, res, next);

      expect(deps.getActiveSessions.execute).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(sessions);
    });

    it('forwards the error to next on failure', async () => {
      const error = new NotFoundError('user_not_found');
      deps.getActiveSessions.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({ user: AUTH_USER });

      await controller.listSessions(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('revokeSession', () => {
    it('revokes the session identified by the path param and returns 204', async () => {
      deps.logout.execute.mockResolvedValue(Result.ok());
      const req = mockReq({ user: AUTH_USER, params: { sessionId: 'session-2' } });

      await controller.revokeSession(req, res, next);

      expect(deps.logout.execute).toHaveBeenCalledWith({ userId: 'user-1', sessionId: 'session-2' });
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('forwards the error to next on failure', async () => {
      const error = new NotFoundError('session_not_found');
      deps.logout.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({ user: AUTH_USER, params: { sessionId: 'session-2' } });

      await controller.revokeSession(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('sendEmailOtp', () => {
    it('sends an email OTP for the current user and returns 204', async () => {
      deps.sendEmailOtp.execute.mockResolvedValue(Result.ok());
      const req = mockReq({ user: AUTH_USER });

      await controller.sendEmailOtp(req, res, next);

      expect(deps.sendEmailOtp.execute).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('forwards the error to next on failure', async () => {
      const error = new NotFoundError('user_not_found');
      deps.sendEmailOtp.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({ user: AUTH_USER });

      await controller.sendEmailOtp(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('verifyEmail', () => {
    it('verifies the email OTP code for the current user and returns 204', async () => {
      deps.verifyEmail.execute.mockResolvedValue(Result.ok());
      const req = mockReq({ user: AUTH_USER, body: { code: '123456' } });

      await controller.verifyEmail(req, res, next);

      expect(deps.verifyEmail.execute).toHaveBeenCalledWith({ userId: 'user-1', code: '123456' });
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('forwards the error to next on failure', async () => {
      const error = new (require('../../../../../domain/shared/errors/ValidationError').ValidationError)('invalid_otp');
      deps.verifyEmail.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({ user: AUTH_USER, body: { code: '000000' } });

      await controller.verifyEmail(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('sendPhoneOtp', () => {
    it('sends a phone OTP to the validated phone number and returns 204', async () => {
      deps.sendPhoneOtp.execute.mockResolvedValue(Result.ok());
      const req = mockReq({ user: AUTH_USER, body: { phone: '+15551234567' } });

      await controller.sendPhoneOtp(req, res, next);

      expect(deps.sendPhoneOtp.execute).toHaveBeenCalledWith({ userId: 'user-1', phone: '+15551234567' });
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('forwards the error to next on failure', async () => {
      const error = new NotFoundError('user_not_found');
      deps.sendPhoneOtp.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({ user: AUTH_USER, body: { phone: '+15551234567' } });

      await controller.sendPhoneOtp(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('verifyPhoneOtp', () => {
    it('verifies the phone OTP code for the current user and returns 204', async () => {
      deps.verifyPhoneOtp.execute.mockResolvedValue(Result.ok());
      const req = mockReq({ user: AUTH_USER, body: { code: '654321' } });

      await controller.verifyPhoneOtp(req, res, next);

      expect(deps.verifyPhoneOtp.execute).toHaveBeenCalledWith({ userId: 'user-1', code: '654321' });
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('forwards the error to next on failure', async () => {
      const error = new NotFoundError('user_not_found');
      deps.verifyPhoneOtp.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({ user: AUTH_USER, body: { code: '654321' } });

      await controller.verifyPhoneOtp(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('forgotPassword', () => {
    it('always returns 204 (no enumeration) on success', async () => {
      deps.forgotPassword.execute.mockResolvedValue(Result.ok());
      const req = mockReq({ body: { email: 'unknown@example.com' } });

      await controller.forgotPassword(req, res, next);

      expect(deps.forgotPassword.execute).toHaveBeenCalledWith({ email: 'unknown@example.com' });
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('forwards the error to next on failure', async () => {
      const error = new (require('../../../../../domain/shared/errors/ValidationError').ValidationError)('invalid_email');
      deps.forgotPassword.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({ body: { email: 'bad' } });

      await controller.forgotPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('resetPassword', () => {
    it('resets the password using email/code/newPassword and returns 204', async () => {
      deps.resetPassword.execute.mockResolvedValue(Result.ok());
      const req = mockReq({ body: { email: 'test@example.com', code: '123456', newPassword: 'NewPassw0rd!' } });

      await controller.resetPassword(req, res, next);

      expect(deps.resetPassword.execute).toHaveBeenCalledWith({
        email: 'test@example.com',
        code: '123456',
        newPassword: 'NewPassw0rd!',
      });
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('forwards the error to next on failure', async () => {
      const error = new NotFoundError('user_not_found');
      deps.resetPassword.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({ body: { email: 'test@example.com', code: '123456', newPassword: 'NewPassw0rd!' } });

      await controller.resetPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('changePassword', () => {
    it('changes the password for the current user, clears cookies, and returns 204', async () => {
      deps.changePassword.execute.mockResolvedValue(Result.ok());
      const req = mockReq({
        user: AUTH_USER,
        body: { currentPassword: 'OldPassw0rd!', newPassword: 'NewPassw0rd!' },
      });

      await controller.changePassword(req, res, next);

      expect(deps.changePassword.execute).toHaveBeenCalledWith({
        userId: 'user-1',
        currentPassword: 'OldPassw0rd!',
        newPassword: 'NewPassw0rd!',
      });
      expect(res.clearCookie).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE, expect.any(Object));
      expect(res.clearCookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE, expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('forwards the error to next on failure without clearing cookies', async () => {
      const error = new ForbiddenError('invalid_current_password');
      deps.changePassword.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({
        user: AUTH_USER,
        body: { currentPassword: 'wrong', newPassword: 'NewPassw0rd!' },
      });

      await controller.changePassword(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.clearCookie).not.toHaveBeenCalled();
    });
  });
});
