import { Router } from 'express';
import { CartController } from '../controllers/CartController';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { ITokenService } from '../../../domain/identity/services/ITokenService';
import { addToCartSchema, updateCartItemSchema, cartItemIdParam, promotionCodeSchema } from '../validators/commerce/cart.validator';

export interface CartRoutesDeps {
  cartController: CartController;
  tokenService: ITokenService;
}

export function createCartRoutes(deps: CartRoutesDeps): Router {
  const router = Router();
  const c = deps.cartController;
  const auth = authenticate(deps.tokenService);

  router.get('/', auth, c.getCart);
  router.get('/summary', auth, c.getCartSummary);
  router.post('/items', auth, validate(addToCartSchema), c.addItem);
  router.patch('/items/:itemId', auth, validate(cartItemIdParam, 'params'), validate(updateCartItemSchema), c.updateItem);
  router.delete('/items/:itemId', auth, validate(cartItemIdParam, 'params'), c.removeItem);
  router.delete('/', auth, c.clearCart);

  router.post('/promotion', auth, validate(promotionCodeSchema), c.applyPromotion);
  router.post('/promotion/validate', auth, validate(promotionCodeSchema), c.validatePromotion);
  router.delete('/promotion', auth, c.removePromotion);

  return router;
}
