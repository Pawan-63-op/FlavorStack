// Thin controller for the OrderRequest query API: GET /v1/order-requests/:id (commerce_module.md §9, Phase 13).
// customerId is always derived from the authenticated actor; the use case enforces ownership (ForbiddenError
// if the requester is not the owner, NotFoundError if no such order request).
import { Request, Response, NextFunction } from 'express';
import { GetOrderRequest } from '../../../application/commerce/use-cases/GetOrderRequest';

export interface OrderRequestControllerDeps {
  getOrderRequest: GetOrderRequest;
}

export class OrderRequestController {
  constructor(private readonly deps: OrderRequestControllerDeps) {}

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.getOrderRequest.execute({
      orderRequestId: req.params.id as string,
      customerId: req.user!.userId,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };
}
