import { Request, Response, NextFunction } from 'express';
import { ReassignRider } from '../../../../application/fulfillment/use-cases/ReassignRider';
import { CancelFulfillment } from '../../../../application/fulfillment/use-cases/CancelFulfillment';
import { GetAdminDashboard } from '../../../../application/fulfillment/use-cases/GetAdminDashboard';
import { CANCELLED_BY } from '../../../../domain/fulfillment/enums/cancelled-by.enum';

export interface AdminFulfillmentControllerDeps {
  reassignRider: ReassignRider;
  cancelFulfillment: CancelFulfillment;
  getAdminDashboard: GetAdminDashboard;
}

export class AdminFulfillmentController {
  constructor(private readonly deps: AdminFulfillmentControllerDeps) {}

  /** GET /admin/fulfillments — admin dashboard with optional filters (Phase 6) */
  getDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const slaBreachedParam = req.query.slaBreached as string | undefined;
    const result = await this.deps.getAdminDashboard.execute({
      status: req.query.status as string | undefined,
      slaBreached: slaBreachedParam !== undefined ? slaBreachedParam === 'true' : undefined,
      restaurantId: req.query.restaurantId as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  /** POST /admin/fulfillments/:id/reassign — admin (re)assigns a rider */
  reassign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.reassignRider.execute({
      fulfillmentId: req.params.id as string,
      riderId: req.body?.riderId,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  /** POST /admin/fulfillments/:id/cancel — admin cancels as SYSTEM (no ownership check) */
  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.cancelFulfillment.execute({
      fulfillmentId: req.params.id as string,
      cancelledBy: CANCELLED_BY.SYSTEM,
      reason: req.body.reason,
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };
}
