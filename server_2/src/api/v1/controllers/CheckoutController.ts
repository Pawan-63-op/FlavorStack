// Thin controller delegating to the Commerce Checkout use case: POST /v1/checkout (commerce_module.md §9).
// customerId is always derived from the authenticated actor (`req.user!.userId`), never from the body. The
// Idempotency-Key is taken from `req.idempotencyKey` (set by the requireIdempotencyKey middleware), so the
// committing checkout is replay-safe: the use case returns the original OrderRequest for a repeated key.
// A successful checkout creates the immutable OrderRequest → 201; an idempotent replay returns the same
// summary (also 201). PreviewCheckout (Phase 13) is the read-only dry-run: POST /v1/checkout/preview returns
// a CheckoutView (pricing breakdown) with no persistence and no Idempotency-Key → 200.
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
