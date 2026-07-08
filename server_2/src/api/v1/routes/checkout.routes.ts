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

  router.post('/', auth, requireIdempotencyKey, audit('commerce.checkout'), validate(checkoutSchema), c.checkout);
  router.post('/preview', auth, validate(previewCheckoutSchema), c.preview);

  return router;
}
