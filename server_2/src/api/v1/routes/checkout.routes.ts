// Mounts CheckoutController under /v1/checkout (Phase 12) — customer-authenticated (§9).
//
// Middleware order matters: authenticate (401 first) → requireIdempotencyKey (required UUID header, 422) →
// validate(checkoutSchema) (body, 422) → controller. This guarantees a well-formed, replay-safe checkout
// command reaches the use case.
import { Router } from 'express';
import { CheckoutController } from '../controllers/CheckoutController';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { audit } from '../middleware/audit';
import { requireIdempotencyKey } from '../middleware/idempotency';
import { ITokenService } from '../../../domain/identity/services/ITokenService';
import { checkoutSchema, previewCheckoutSchema } from '../validators/checkout.validator';

export interface CheckoutRoutesDeps {
  checkoutController: CheckoutController;
  tokenService: ITokenService;
}

export function createCheckoutRoutes(deps: CheckoutRoutesDeps): Router {
  const router = Router();
  const c = deps.checkoutController;
  const auth = authenticate(deps.tokenService);

  // Phase 14: audit the checkout command (§11) — a structured trail entry emitted once the response
  // finishes (non-blocking), complementing the immutable OrderRequest audit artifact the use case writes.
  router.post('/', auth, requireIdempotencyKey, audit('commerce.checkout'), validate(checkoutSchema), c.checkout);
  // Phase 13 — read-only dry-run pricing. No Idempotency-Key (nothing is persisted).
  router.post('/preview', auth, validate(previewCheckoutSchema), c.preview);

  return router;
}
