import { Request, Response, NextFunction } from 'express';
import { Checkout } from '../../../application/commerce/use-cases/Checkout';
import { PreviewCheckout } from '../../../application/commerce/use-cases/PreviewCheckout';
import { CheckoutRequestDto } from '../../../application/commerce/dtos/CheckoutRequestDto';
import { PreviewCheckoutDto } from '../../../application/commerce/dtos/PreviewCheckoutDto';

export interface CheckoutControllerDeps {
  checkout: Checkout;
  previewCheckout: PreviewCheckout;
}

export class CheckoutController {
  constructor(private readonly deps: CheckoutControllerDeps) {}

  checkout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const body = req.body as Pick<CheckoutRequestDto, 'paymentMethod' | 'addressId' | 'deliveryAddress'>;
    const result = await this.deps.checkout.execute({
      customerId: req.user!.userId,
      idempotencyKey: req.idempotencyKey,
      paymentMethod: body.paymentMethod,
      addressId: body.addressId,
      deliveryAddress: body.deliveryAddress,
    });
    if (result.isFailure) return next(result.getError());
    res.status(201).json(result.getValue());
  };

  preview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const body = req.body as Pick<PreviewCheckoutDto, 'addressId' | 'deliveryPoint'>;
    const result = await this.deps.previewCheckout.execute({
      customerId: req.user!.userId,
      addressId: body.addressId,
      deliveryPoint: body.deliveryPoint,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };
}
