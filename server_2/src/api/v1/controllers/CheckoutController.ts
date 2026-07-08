import { Request, Response, NextFunction } from 'express';
import { Checkout } from '../../../application/commerce/use-cases/Checkout';
import { PreviewCheckout } from '../../../application/commerce/use-cases/PreviewCheckout';

export interface CheckoutControllerDeps {
  checkout: Checkout;
  previewCheckout: PreviewCheckout;
}

export class CheckoutController {
  constructor(private readonly deps: CheckoutControllerDeps) {}

  checkout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.checkout.execute({
      customerId: req.user!.userId,
      idempotencyKey: req.idempotencyKey,
      paymentMethod: req.body.paymentMethod,
      deliveryAddress: req.body.deliveryAddress,
    });
    if (result.isFailure) return next(result.getError());
    res.status(201).json(result.getValue());
  };

  preview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.previewCheckout.execute({
      customerId: req.user!.userId,
      deliveryPoint: req.body.deliveryPoint,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };
}
