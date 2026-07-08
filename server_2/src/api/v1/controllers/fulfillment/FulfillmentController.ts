import { Request, Response, NextFunction } from 'express';
import { MarkPreparing } from '../../../../application/fulfillment/use-cases/MarkPreparing';
import { MarkReadyForPickup } from '../../../../application/fulfillment/use-cases/MarkReadyForPickup';
import { GetRestaurantFulfillments } from '../../../../application/fulfillment/use-cases/GetRestaurantFulfillments';
import { CancelFulfillment } from '../../../../application/fulfillment/use-cases/CancelFulfillment';
import { GetLiveTracking } from '../../../../application/fulfillment/use-cases/GetLiveTracking';
import { ListCustomerOrders } from '../../../../application/fulfillment/use-cases/ListCustomerOrders';
import { CANCELLED_BY } from '../../../../domain/fulfillment/enums/cancelled-by.enum';
import { USER_ROLE } from '../../../../domain/identity/enums/user-role.enum';

export interface FulfillmentControllerDeps {
  markPreparing: MarkPreparing;
  markReadyForPickup: MarkReadyForPickup;
  getRestaurantFulfillments: GetRestaurantFulfillments;
  cancelFulfillment: CancelFulfillment;
  getLiveTracking: GetLiveTracking;
  listCustomerOrders: ListCustomerOrders;
}

export class FulfillmentController {
  constructor(private readonly deps: FulfillmentControllerDeps) {}

  /** POST /fulfillments/:id/preparing — restaurant starts preparation */
  markPreparing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.markPreparing.execute({
      fulfillmentId: req.params.id as string,
      actorUserId: req.user!.userId,
      prepEstimateMinutes: req.body.prepEstimateMinutes,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  /** POST /fulfillments/:id/ready — restaurant marks food ready for pickup */
  markReadyForPickup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.markReadyForPickup.execute({
      fulfillmentId: req.params.id as string,
      actorUserId: req.user!.userId,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  /** GET /restaurants/:restaurantId/fulfillments — restaurant queue board */
  getRestaurantFulfillments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.getRestaurantFulfillments.execute({
      restaurantId: req.params.restaurantId as string,
      status: req.query.status as string | undefined,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  /**
   * POST /fulfillments/:id/cancel — customer or restaurant cancels (Phase 5A).
   * The actor is resolved from the authenticated role: a CUSTOMER cancels as CUSTOMER, anyone else
   * (restaurant owner, whose userId is the restaurantId) cancels as RESTAURANT. The aggregate
   * enforces ownership and the cancellation window.
   */
  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const isCustomer = req.user!.role === USER_ROLE.CUSTOMER;
    const result = await this.deps.cancelFulfillment.execute({
      fulfillmentId: req.params.id as string,
      cancelledBy: isCustomer ? CANCELLED_BY.CUSTOMER : CANCELLED_BY.RESTAURANT,
      reason: req.body.reason,
      actorId: req.user!.userId,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  /** GET /fulfillments/:id/tracking — customer live order tracking (Phase 6) */
  getTracking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.getLiveTracking.execute({
      fulfillmentId: req.params.id as string,
      customerId: req.user!.userId,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  /**
   * GET /me/orders — the authenticated customer's order history (Phase 15 / G1).
   * Each row carries orderRequestId + fulfillmentId so the frontend can resolve and
   * track orders without the client-only localStorage linkage. Customer-scoped to
   * the authenticated userId.
   */
  listMyOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;
    const result = await this.deps.listCustomerOrders.execute({
      customerId: req.user!.userId,
      limit,
      offset,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };
}
