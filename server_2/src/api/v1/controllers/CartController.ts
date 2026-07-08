import { Request, Response, NextFunction } from 'express';
import { GetCart } from '../../../application/commerce/use-cases/GetCart';
import { GetCartSummary } from '../../../application/commerce/use-cases/GetCartSummary';
import { AddToCart } from '../../../application/commerce/use-cases/AddToCart';
import { RemoveFromCart } from '../../../application/commerce/use-cases/RemoveFromCart';
import { UpdateCartItem } from '../../../application/commerce/use-cases/UpdateCartItem';
import { ClearCart } from '../../../application/commerce/use-cases/ClearCart';
import { ApplyPromotion } from '../../../application/commerce/use-cases/ApplyPromotion';
import { RemovePromotion } from '../../../application/commerce/use-cases/RemovePromotion';
import { ValidatePromotion } from '../../../application/commerce/use-cases/ValidatePromotion';

export interface CartControllerDeps {
  getCart: GetCart;
  getCartSummary: GetCartSummary;
  addToCart: AddToCart;
  removeFromCart: RemoveFromCart;
  updateCartItem: UpdateCartItem;
  clearCart: ClearCart;
  applyPromotion: ApplyPromotion;
  removePromotion: RemovePromotion;
  validatePromotion: ValidatePromotion;
}

export class CartController {
  constructor(private readonly deps: CartControllerDeps) {}

  getCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.getCart.execute({ customerId: req.user!.userId });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  getCartSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.getCartSummary.execute({ customerId: req.user!.userId });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.addToCart.execute({
      customerId: req.user!.userId,
      ...req.body,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  updateItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.updateCartItem.execute({
      customerId: req.user!.userId,
      cartItemId: req.params.itemId as string,
      quantity: req.body.quantity,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  removeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.removeFromCart.execute({
      customerId: req.user!.userId,
      cartItemId: req.params.itemId as string,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  clearCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.clearCart.execute({ customerId: req.user!.userId });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  applyPromotion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.applyPromotion.execute({
      customerId: req.user!.userId,
      code: req.body.code,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  removePromotion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.removePromotion.execute({ customerId: req.user!.userId });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  validatePromotion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.validatePromotion.execute({
      customerId: req.user!.userId,
      code: req.body.code,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };
}
