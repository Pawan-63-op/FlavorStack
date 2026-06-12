// Aggregates all Identity routers under /api/v1, constructing controllers from AppContainer
import { Router } from 'express';
import { AppContainer } from '../../../container';
import { AuthController } from '../controllers/AuthController';
import { IdentityController } from '../controllers/IdentityController';
import { PermissionDeps } from '../middleware/authorize';
import { createAuthRoutes } from './auth.routes';
import { createUserRoutes } from './user.routes';
import { createAdminRoutes } from './admin.routes';

export function createApiRouter(app: AppContainer): Router {
  const router = Router();

  const authController = new AuthController({
    registerUser: app.useCases.registerUser,
    login: app.useCases.login,
    refreshToken: app.useCases.refreshToken,
    logout: app.useCases.logout,
    logoutAllSessions: app.useCases.logoutAllSessions,
    getActiveSessions: app.useCases.getActiveSessions,
    forgotPassword: app.useCases.forgotPassword,
    resetPassword: app.useCases.resetPassword,
    changePassword: app.useCases.changePassword,
    sendEmailOtp: app.useCases.sendEmailOtp,
    verifyEmailOtp: app.useCases.verifyEmailOtp,
    sendPhoneOtp: app.useCases.sendPhoneOtp,
    verifyPhoneOtp: app.useCases.verifyPhoneOtp,
  });

  const identityController = new IdentityController({
    getProfile: app.useCases.getProfile,
    updateProfile: app.useCases.updateProfile,
    assignRole: app.useCases.assignRole,
    grantPermission: app.useCases.grantPermission,
    banUser: app.useCases.banUser,
    unbanUser: app.useCases.unbanUser,
  });

  const permissionDeps: PermissionDeps = {
    userRepository: app.identity.userRepository,
    rbacService: app.auth.rbacService,
  };

  router.use(
    '/auth',
    createAuthRoutes({
      controller: authController,
      tokenService: app.auth.tokenService,
      rateLimiter: app.auth.rateLimiter,
    }),
  );

  router.use(
    '/users',
    createUserRoutes({
      controller: identityController,
      tokenService: app.auth.tokenService,
    }),
  );

  router.use(
    '/admin',
    createAdminRoutes({
      controller: identityController,
      tokenService: app.auth.tokenService,
      permissionDeps,
    }),
  );

  return router;
}
