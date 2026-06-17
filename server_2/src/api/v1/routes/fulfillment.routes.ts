// Fulfillment API routes.
//  - Phase 2: restaurant preparation flow.
//  - Phase 3B: rider accept/reject + admin reassignment.
//  - Phase 5A/5B: cancellation, failure.
//  - Phase 6: read-model query endpoints (tracking, rider queue, admin dashboard).
import { Router } from 'express';
import { FulfillmentController } from '../controllers/fulfillment/FulfillmentController';
import { RiderController } from '../controllers/fulfillment/RiderController';
import { AdminFulfillmentController } from '../controllers/fulfillment/AdminFulfillmentController';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
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
} from '../validators/fulfillment/fulfillment.validator';

export interface FulfillmentRoutesDeps {
  fulfillmentController: FulfillmentController;
  riderController: RiderController;
  adminFulfillmentController: AdminFulfillmentController;
  tokenService: ITokenService;
}

export function createFulfillmentRoutes(deps: FulfillmentRoutesDeps): Router {
  const router = Router();
  const ctrl = deps.fulfillmentController;
  const rider = deps.riderController;
  const admin = deps.adminFulfillmentController;
  const auth = authenticate(deps.tokenService);

  // ── Restaurant (Phase 2) ──────────────────────────────────────────────────
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

  // ── Customer tracking (Phase 6) ───────────────────────────────────────────
  router.get(
    '/fulfillments/:id/tracking',
    auth,
    validate(fulfillmentIdParam, 'params'),
    ctrl.getTracking
  );

  // ── Rider (Phase 3B) ──────────────────────────────────────────────────────
  router.get(
    '/riders/me/queue',
    auth,
    requireRole(USER_ROLE.DRIVER),
    rider.getQueue
  );

  router.post(
    '/fulfillments/:id/accept',
    auth,
    requireRole(USER_ROLE.DRIVER),
    validate(fulfillmentIdParam, 'params'),
    rider.accept
  );

  router.post(
    '/fulfillments/:id/reject',
    auth,
    requireRole(USER_ROLE.DRIVER),
    validate(fulfillmentIdParam, 'params'),
    validate(rejectDeliverySchema, 'body'),
    rider.reject
  );

  // ── Rider delivery flow (Phase 4) ─────────────────────────────────────────
  router.post(
    '/fulfillments/:id/pickup',
    auth,
    requireRole(USER_ROLE.DRIVER),
    validate(fulfillmentIdParam, 'params'),
    rider.pickup
  );

  router.post(
    '/fulfillments/:id/out-for-delivery',
    auth,
    requireRole(USER_ROLE.DRIVER),
    validate(fulfillmentIdParam, 'params'),
    rider.outForDelivery
  );

  router.post(
    '/fulfillments/:id/deliver',
    auth,
    requireRole(USER_ROLE.DRIVER),
    validate(fulfillmentIdParam, 'params'),
    validate(deliverSchema, 'body'),
    rider.deliver
  );

  // ── Rider live location (Phase 7) ─────────────────────────────────────────
  // HTTP fallback for the WS `location` event; both converge on RecordRiderLocation.
  router.post(
    '/fulfillments/:id/location',
    auth,
    requireRole(USER_ROLE.DRIVER),
    validate(fulfillmentIdParam, 'params'),
    validate(locationSchema, 'body'),
    rider.location
  );

  // ── Delivery failure (Phase 5B) ───────────────────────────────────────────
  router.post(
    '/fulfillments/:id/fail',
    auth,
    requireRole(USER_ROLE.DRIVER),
    validate(fulfillmentIdParam, 'params'),
    validate(failSchema, 'body'),
    rider.fail
  );

  // ── Cancellation (Phase 5A) ───────────────────────────────────────────────
  router.post(
    '/fulfillments/:id/cancel',
    auth,
    validate(fulfillmentIdParam, 'params'),
    validate(cancelSchema, 'body'),
    ctrl.cancel
  );

  // ── Admin (Phase 3B + 5A + 6) ────────────────────────────────────────────
  router.get(
    '/admin/fulfillments',
    auth,
    requireRole(USER_ROLE.ADMIN),
    validate(adminDashboardQuery, 'query'),
    admin.getDashboard
  );

  router.post(
    '/admin/fulfillments/:id/reassign',
    auth,
    requireRole(USER_ROLE.ADMIN),
    validate(fulfillmentIdParam, 'params'),
    validate(reassignSchema, 'body'),
    admin.reassign
  );

  router.post(
    '/admin/fulfillments/:id/cancel',
    auth,
    requireRole(USER_ROLE.ADMIN),
    validate(fulfillmentIdParam, 'params'),
    validate(cancelSchema, 'body'),
    admin.cancel
  );

  return router;
}
