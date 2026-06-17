// Thin HTTP delivery for rider-side assignment use-cases (Phase 3B) and queue query (Phase 6).
// The authenticated rider is req.user!.userId; the aggregate enforces it matches the offered rider.
import { Request, Response, NextFunction } from 'express';
import { AcceptDelivery } from '../../../../application/fulfillment/use-cases/AcceptDelivery';
import { RejectDelivery } from '../../../../application/fulfillment/use-cases/RejectDelivery';
import { ConfirmPickup } from '../../../../application/fulfillment/use-cases/ConfirmPickup';
import { StartDelivery } from '../../../../application/fulfillment/use-cases/StartDelivery';
import { CompleteDelivery } from '../../../../application/fulfillment/use-cases/CompleteDelivery';
import { FailDelivery } from '../../../../application/fulfillment/use-cases/FailDelivery';
import { GetRiderQueue } from '../../../../application/fulfillment/use-cases/GetRiderQueue';
import { RecordRiderLocation } from '../../../../application/fulfillment/use-cases/RecordRiderLocation';

export interface RiderControllerDeps {
  acceptDelivery: AcceptDelivery;
  rejectDelivery: RejectDelivery;
  confirmPickup: ConfirmPickup;
  startDelivery: StartDelivery;
  completeDelivery: CompleteDelivery;
  failDelivery: FailDelivery;
  getRiderQueue: GetRiderQueue;
  recordRiderLocation: RecordRiderLocation;
}

export class RiderController {
  constructor(private readonly deps: RiderControllerDeps) {}

  /** GET /riders/me/queue — rider's active delivery queue (Phase 6) */
  getQueue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.getRiderQueue.execute({
      riderId: req.user!.userId,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  /** POST /fulfillments/:id/accept — rider accepts the active offer */
  accept = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.acceptDelivery.execute({
      fulfillmentId: req.params.id as string,
      riderId: req.user!.userId,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  /** POST /fulfillments/:id/reject — rider declines the active offer (triggers re-offer) */
  reject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.rejectDelivery.execute({
      fulfillmentId: req.params.id as string,
      riderId: req.user!.userId,
      reason: req.body?.reason,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  /** POST /fulfillments/:id/pickup — assigned rider collects the food */
  pickup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.confirmPickup.execute({
      fulfillmentId: req.params.id as string,
      riderId: req.user!.userId,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  /** POST /fulfillments/:id/out-for-delivery — assigned rider departs for the customer */
  outForDelivery = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.startDelivery.execute({
      fulfillmentId: req.params.id as string,
      riderId: req.user!.userId,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  /** POST /fulfillments/:id/deliver — assigned rider hands the order to the customer */
  deliver = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.completeDelivery.execute({
      fulfillmentId: req.params.id as string,
      riderId: req.user!.userId,
      proof: req.body?.proof,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  /**
   * POST /fulfillments/:id/location — rider GPS ping (Phase 7). HTTP fallback for the WS
   * `location` event. Writes Redis latest + throttled Mongo + broadcasts to the room; no aggregate
   * write. Returns 204. Ownership is enforced inside RecordRiderLocation.
   */
  location = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.recordRiderLocation.execute({
      fulfillmentId: req.params.id as string,
      riderId: req.user!.userId,
      lat: req.body.lat,
      lng: req.body.lng,
    });
    if (result.isFailure) return next(result.getError());
    res.status(204).send();
  };

  /** POST /fulfillments/:id/fail — assigned rider reports an unrecoverable delivery failure */
  fail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.failDelivery.execute({
      fulfillmentId: req.params.id as string,
      riderId: req.user!.userId,
      failureReason: req.body.failureReason,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };
}
