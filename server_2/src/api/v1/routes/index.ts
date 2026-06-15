// Aggregates all Identity routers under /api/v1, constructing controllers from AppContainer
import { Router } from 'express';
import { AppContainer } from '../../../container';
import { AuthController } from '../controllers/AuthController';
import { IdentityController } from '../controllers/IdentityController';
import { PermissionDeps } from '../middleware/authorize';
import { createAuthRoutes } from './auth.routes';
import { createUserRoutes } from './user.routes';
import { createAdminRoutes } from './admin.routes';
import { createCatalogRoutes } from './catalog/catalog.routes';
import { RestaurantController } from '../controllers/catalog/RestaurantController';
import { MenuController } from '../controllers/catalog/MenuController';
import { DiscoveryController } from '../controllers/catalog/DiscoveryController';
import { createCartRoutes } from './cart.routes';
import { CartController } from '../controllers/CartController';
import { createCheckoutRoutes } from './checkout.routes';
import { CheckoutController } from '../controllers/CheckoutController';
import { createOrderRequestRoutes } from './order-request.routes';
import { OrderRequestController } from '../controllers/OrderRequestController';

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

  const cmd = app.catalogWrite.commands;
  const restaurantController = new RestaurantController({
    createRestaurant: cmd.createRestaurant,
    updateRestaurant: cmd.updateRestaurant,
    publishRestaurant: cmd.publishRestaurant,
    pauseRestaurant: cmd.pauseRestaurant,
    closeRestaurant: cmd.closeRestaurant,
    deleteRestaurant: cmd.deleteRestaurant,
    setRestaurantVisibility: cmd.setRestaurantVisibility,
    setOpeningHours: cmd.setOpeningHours,
    addCategory: cmd.addCategory,
    updateCategory: cmd.updateCategory,
    reorderCategories: cmd.reorderCategories,
    removeCategory: cmd.removeCategory,
    manageDeliveryZone: cmd.manageDeliveryZone,
    imageStorage: app.catalogWrite.imageStorage,
  });
  const menuController = new MenuController({
    addMenuItem: cmd.addMenuItem,
    updateMenuItem: cmd.updateMenuItem,
    toggleMenuItemAvailability: cmd.toggleMenuItemAvailability,
    removeMenuItem: cmd.removeMenuItem,
    setItemVariants: cmd.setItemVariants,
    imageStorage: app.catalogWrite.imageStorage,
  });
  const discoveryController = new DiscoveryController({ ...app.catalogRead.queries });

  router.use(
    '/catalog',
    createCatalogRoutes({
      restaurantController,
      menuController,
      discoveryController,
      tokenService: app.auth.tokenService,
      rateLimiter: app.auth.rateLimiter,
    }),
  );

  const cartCmd = app.commerce.commands;
  const cartController = new CartController({
    getCart: cartCmd.getCart,
    getCartSummary: cartCmd.getCartSummary,
    addToCart: cartCmd.addToCart,
    removeFromCart: cartCmd.removeFromCart,
    updateCartItem: cartCmd.updateCartItem,
    clearCart: cartCmd.clearCart,
    applyPromotion: cartCmd.applyPromotion,
    removePromotion: cartCmd.removePromotion,
    validatePromotion: cartCmd.validatePromotion,
  });

  router.use(
    '/cart',
    createCartRoutes({
      cartController,
      tokenService: app.auth.tokenService,
    }),
  );

  const checkoutController = new CheckoutController({
    checkout: cartCmd.checkout,
    previewCheckout: cartCmd.previewCheckout,
  });

  router.use(
    '/checkout',
    createCheckoutRoutes({
      checkoutController,
      tokenService: app.auth.tokenService,
    }),
  );

  const orderRequestController = new OrderRequestController({
    getOrderRequest: cartCmd.getOrderRequest,
  });

  router.use(
    '/order-requests',
    createOrderRequestRoutes({
      orderRequestController,
      tokenService: app.auth.tokenService,
    }),
  );

  return router;
}
