// Engagement: review submission, listing, rating, and admin moderation API routes (engagement_module.md §5).
import { Router } from 'express';
import { ReviewController } from '../controllers/ReviewController';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { USER_ROLE } from '../../../domain/identity/enums/user-role.enum';
import { ITokenService } from '../../../domain/identity/services/ITokenService';
import {
  submitReviewSchema,
  restaurantIdParam,
  reviewIdParam,
  reviewsListQuery,
  myReviewsQuery,
  moderateReviewSchema,
  pendingReviewsQuery,
} from '../validators/review.validator';

export interface ReviewRoutesDeps {
  controller: ReviewController;
  tokenService: ITokenService;
}

export function createReviewRoutes(deps: ReviewRoutesDeps): Router {
  const router = Router();
  const ctrl = deps.controller;
  const auth = authenticate(deps.tokenService);

  // ── Customer ───────────────────────────────────────────────────────────
  router.post(
    '/restaurants/:restaurantId/reviews',
    auth,
    requireRole(USER_ROLE.CUSTOMER),
    validate(restaurantIdParam, 'params'),
    validate(submitReviewSchema, 'body'),
    ctrl.submit
  );

  router.get('/me/reviews', auth, validate(myReviewsQuery, 'query'), ctrl.getMine);

  // ── Public ─────────────────────────────────────────────────────────────
  router.get(
    '/restaurants/:restaurantId/reviews',
    validate(restaurantIdParam, 'params'),
    validate(reviewsListQuery, 'query'),
    ctrl.getForRestaurant
  );

  router.get('/restaurants/:restaurantId/rating', validate(restaurantIdParam, 'params'), ctrl.getRating);

  // ── Admin (moderation) ─────────────────────────────────────────────────
  router.get(
    '/admin/reviews',
    auth,
    requireRole(USER_ROLE.ADMIN),
    validate(pendingReviewsQuery, 'query'),
    ctrl.listPending
  );

  router.post(
    '/admin/reviews/:id/approve',
    auth,
    requireRole(USER_ROLE.ADMIN),
    validate(reviewIdParam, 'params'),
    validate(moderateReviewSchema, 'body'),
    ctrl.approve
  );

  router.post(
    '/admin/reviews/:id/reject',
    auth,
    requireRole(USER_ROLE.ADMIN),
    validate(reviewIdParam, 'params'),
    validate(moderateReviewSchema, 'body'),
    ctrl.reject
  );

  return router;
}
