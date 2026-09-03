import { Router } from 'express';
import { FulfillmentController } from '../controllers/fulfillment/FulfillmentController';
import { RiderController } from '../controllers/fulfillment/RiderController';
import { AdminFulfillmentController } from '../controllers/fulfillment/AdminFulfillmentController';
import { DashboardAnalyticsController } from '../controllers/fulfillment/DashboardAnalyticsController';
import { authenticate } from '../middleware/authenticate';
import { requireRole, PermissionDeps } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { USER_ROLE } from '../../../domain/identity/enums/user-role.enum';
import { ITokenService } from '../../../domain/identity/services/ITokenService';
import {
  fulfillmentIdParam,
  restaurantIdParam,
  markPreparingSchema,
  restaurantFulfillmentsQuery,
  rejectDeliverySchema,
  reassignSchema,
  deliverSchema,
  cancelSchema,
  failSchema,
  locationSchema,
  adminDashboardQuery,
  analyticsQuery,
  myOrdersQuery,
} from '../validators/fulfillment/fulfillment.validator';

export interface FulfillmentRoutesDeps {
  fulfillmentController: FulfillmentController;
  riderController: RiderController;
  adminFulfillmentController: AdminFulfillmentController;
  dashboardAnalyticsController: DashboardAnalyticsController;
  tokenService: ITokenService;
  permissionDeps: PermissionDeps;
}

export function createFulfillmentRoutes(deps: FulfillmentRoutesDeps): Router {
  const router = Router();
  const ctrl = deps.fulfillmentController;
  const rider = deps.riderController;
  const admin = deps.adminFulfillmentController;
  const analytics = deps.dashboardAnalyticsController;
  const auth = authenticate(deps.tokenService);

  router.post(
    '/fulfillments/:id/preparing',
    auth,
    validate(fulfillmentIdParam, 'params'),
    validate(markPreparingSchema, 'body'),
    ctrl.markPreparing
  );

  router.post('/fulfillments/:id/ready', auth, validate(fulfillmentIdParam, 'params'), ctrl.markReadyForPickup);

  router.get(
    '/restaurants/:restaurantId/fulfillments',
    auth,
    validate(restaurantIdParam, 'params'),
    validate(restaurantFulfillmentsQuery, 'query'),
    ctrl.getRestaurantFulfillments
  );

  router.get(
    '/fulfillments/:id/tracking',
    auth,
    validate(fulfillmentIdParam, 'params'),
    ctrl.getTracking
  );

  router.get('/me/orders', auth, validate(myOrdersQuery, 'query'), ctrl.listMyOrders);

  router.get(
    '/riders/me/queue',
    auth,
    requireRole(deps.permissionDeps, USER_ROLE.DRIVER),
    rider.getQueue
  );

  router.get(
    '/riders/me/deliveries',
    auth,
    requireRole(deps.permissionDeps, USER_ROLE.DRIVER),
    validate(myOrdersQuery, 'query'),
    rider.getDeliveryHistory
  );

  router.post(
    '/fulfillments/:id/accept',
    auth,
    requireRole(deps.permissionDeps, USER_ROLE.DRIVER),
    validate(fulfillmentIdParam, 'params'),
    rider.accept
  );

  router.post(
    '/fulfillments/:id/reject',
    auth,
    requireRole(deps.permissionDeps, USER_ROLE.DRIVER),
    validate(fulfillmentIdParam, 'params'),
    validate(rejectDeliverySchema, 'body'),
    rider.reject
  );

  router.post(
    '/fulfillments/:id/pickup',
    auth,
    requireRole(deps.permissionDeps, USER_ROLE.DRIVER),
    validate(fulfillmentIdParam, 'params'),
    rider.pickup
  );

  router.post(
    '/fulfillments/:id/out-for-delivery',
    auth,
    requireRole(deps.permissionDeps, USER_ROLE.DRIVER),
    validate(fulfillmentIdParam, 'params'),
    rider.outForDelivery
  );

  router.post(
    '/fulfillments/:id/deliver',
    auth,
    requireRole(deps.permissionDeps, USER_ROLE.DRIVER),
    validate(fulfillmentIdParam, 'params'),
    validate(deliverSchema, 'body'),
    rider.deliver
  );

  router.post(
    '/fulfillments/:id/location',
    auth,
    requireRole(deps.permissionDeps, USER_ROLE.DRIVER),
    validate(fulfillmentIdParam, 'params'),
    validate(locationSchema, 'body'),
    rider.location
  );

  router.post(
    '/fulfillments/:id/fail',
    auth,
    requireRole(deps.permissionDeps, USER_ROLE.DRIVER),
    validate(fulfillmentIdParam, 'params'),
    validate(failSchema, 'body'),
    rider.fail
  );

  router.post(
    '/fulfillments/:id/cancel',
    auth,
    validate(fulfillmentIdParam, 'params'),
    validate(cancelSchema, 'body'),
    ctrl.cancel
  );

  router.get(
    '/admin/fulfillments',
    auth,
    requireRole(deps.permissionDeps, USER_ROLE.ADMIN),
    validate(adminDashboardQuery, 'query'),
    admin.getDashboard
  );

  router.post(
    '/admin/fulfillments/:id/reassign',
    auth,
    requireRole(deps.permissionDeps, USER_ROLE.ADMIN),
    validate(fulfillmentIdParam, 'params'),
    validate(reassignSchema, 'body'),
    admin.reassign
  );

  router.post(
    '/admin/fulfillments/:id/cancel',
    auth,
    requireRole(deps.permissionDeps, USER_ROLE.ADMIN),
    validate(fulfillmentIdParam, 'params'),
    validate(cancelSchema, 'body'),
    admin.cancel
  );

  router.get('/owner/analytics', auth, validate(analyticsQuery, 'query'), analytics.getOwner);
  router.get(
    '/admin/analytics',
    auth,
    requireRole(deps.permissionDeps, USER_ROLE.ADMIN),
    validate(analyticsQuery, 'query'),
    analytics.getPlatform
  );

  return router;
}
