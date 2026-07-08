import { Request, Response, NextFunction } from 'express';
import { GetDashboardAnalytics } from '../../../../application/fulfillment/use-cases/GetDashboardAnalytics';

export interface DashboardAnalyticsControllerDeps {
  getDashboardAnalytics: GetDashboardAnalytics;
}

export class DashboardAnalyticsController {
  constructor(private readonly deps: DashboardAnalyticsControllerDeps) {}

  getOwner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.getDashboardAnalytics.execute({
      scope: 'OWNER',
      ownerId: req.user!.userId,
      windowDays: parseDays(req.query.days),
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };

  getPlatform = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.getDashboardAnalytics.execute({
      scope: 'PLATFORM',
      windowDays: parseDays(req.query.days),
    });
    if (result.isFailure) return next(result.getError());
    res.status(200).json(result.getValue());
  };
}

/** `?days=` is validated as a digit string upstream; undefined when absent. */
function parseDays(days: unknown): number | undefined {
  return typeof days === 'string' ? parseInt(days, 10) : undefined;
}
