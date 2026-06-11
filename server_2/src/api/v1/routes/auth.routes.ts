// Mounts AuthController — 14 self-service auth routes (register..change-password)
import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authenticate } from '../middleware/authenticate';
import { rateLimit } from '../middleware/rateLimiter';
import { audit } from '../middleware/audit';
import { validate } from '../middleware/validate';
import { ITokenService } from '../../../domain/identity/services/ITokenService';
import { RateLimiter } from '../../../infrastructure/redis/RateLimiter';
import {
  registerSchema,
  loginSchema,
  otpCodeSchema,
  phoneSchema,
  forgotSchema,
  resetSchema,
  changePasswordSchema,
} from '../validators/auth.validator';
import { sessionIdParam } from '../validators/common.validator';

export interface AuthRoutesDeps {
  controller: AuthController;
  tokenService: ITokenService;
  rateLimiter: RateLimiter;
}

export function createAuthRoutes(deps: AuthRoutesDeps): Router {
  const router = Router();
  const c = deps.controller;
  const auth = authenticate(deps.tokenService);

  router.post('/register', audit('auth.register'), validate(registerSchema), c.register);

  router.post(
    '/login',
    rateLimit(deps.rateLimiter, 'login'),
    audit('auth.login'),
    validate(loginSchema),
    c.login,
  );

  router.post('/refresh', audit('auth.refresh'), c.refresh);

  router.post('/logout', auth, audit('auth.logout'), c.logout);

  router.post('/logout-all', auth, audit('auth.logout-all'), c.logoutAll);

  router.get('/sessions', auth, c.listSessions);

  router.delete(
    '/sessions/:sessionId',
    auth,
    audit('auth.revoke-session'),
    validate(sessionIdParam, 'params'),
    c.revokeSession,
  );

  router.post(
    '/email-otp/send',
    auth,
    rateLimit(deps.rateLimiter, 'otp-generation'),
    audit('auth.send-email-otp'),
    c.sendEmailOtp,
  );

  router.post(
    '/email-otp/verify',
    auth,
    rateLimit(deps.rateLimiter, 'otp-verification'),
    audit('auth.verify-email-otp'),
    validate(otpCodeSchema),
    c.verifyEmailOtp,
  );

  router.post(
    '/phone-otp/send',
    auth,
    rateLimit(deps.rateLimiter, 'otp-generation'),
    audit('auth.send-phone-otp'),
    validate(phoneSchema),
    c.sendPhoneOtp,
  );

  router.post(
    '/phone-otp/verify',
    auth,
    rateLimit(deps.rateLimiter, 'otp-verification'),
    audit('auth.verify-phone-otp'),
    validate(otpCodeSchema),
    c.verifyPhoneOtp,
  );

  router.post(
    '/forgot-password',
    rateLimit(deps.rateLimiter, 'password-reset'),
    audit('auth.forgot-password'),
    validate(forgotSchema),
    c.forgotPassword,
  );

  router.post(
    '/reset-password',
    rateLimit(deps.rateLimiter, 'password-reset'),
    audit('auth.reset-password'),
    validate(resetSchema),
    c.resetPassword,
  );

  router.post(
    '/change-password',
    auth,
    audit('auth.change-password'),
    validate(changePasswordSchema),
    c.changePassword,
  );

  return router;
}
