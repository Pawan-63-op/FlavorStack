// Thin HTTP delivery for notification preferences + history use-cases. Zero business logic.
import { Request, Response, NextFunction } from 'express';
import { UpdateNotificationPreferences } from '../../../application/engagement/use-cases/UpdateNotificationPreferences';
import { GetNotificationPreferences } from '../../../application/engagement/use-cases/GetNotificationPreferences';
import { GetNotificationHistory } from '../../../application/engagement/use-cases/GetNotificationHistory';
import { GetUnreadCount } from '../../../application/engagement/use-cases/GetUnreadCount';
import { MarkNotificationRead } from '../../../application/engagement/use-cases/MarkNotificationRead';

export interface NotificationControllerDeps {
  updateNotificationPreferences: UpdateNotificationPreferences;
  getNotificationPreferences: GetNotificationPreferences;
  getNotificationHistory: GetNotificationHistory;
  getUnreadCount: GetUnreadCount;
  markNotificationRead: MarkNotificationRead;
}

export class NotificationController {
  constructor(private readonly deps: NotificationControllerDeps) {}

  getPreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.getNotificationPreferences.execute({ userId: req.user!.userId });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(200).json(result.getValue());
  };

  updatePreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.updateNotificationPreferences.execute({
      userId: req.user!.userId,
      changes: req.body.changes,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(200).json(result.getValue());
  };

  getHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.getNotificationHistory.execute({
      userId: req.user!.userId,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(200).json(result.getValue());
  };

  getUnreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.getUnreadCount.execute({ userId: req.user!.userId });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(200).json(result.getValue());
  };

  markRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.markNotificationRead.execute({
      userId: req.user!.userId,
      notificationId: req.params.id as string,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(200).json(result.getValue());
  };
}
