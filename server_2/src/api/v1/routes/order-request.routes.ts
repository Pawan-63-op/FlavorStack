import { Router } from 'express';
import { OrderRequestController } from '../controllers/OrderRequestController';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { ITokenService } from '../../../domain/identity/services/ITokenService';
import { orderRequestIdParam } from '../validators/commerce/order-request.validator';

export interface OrderRequestRoutesDeps {
  orderRequestController: OrderRequestController;
  tokenService: ITokenService;
}

export function createOrderRequestRoutes(deps: OrderRequestRoutesDeps): Router {
  const router = Router();
  const c = deps.orderRequestController;
  const auth = authenticate(deps.tokenService);

  router.get('/:id', auth, validate(orderRequestIdParam, 'params'), c.getById);

  return router;
}
