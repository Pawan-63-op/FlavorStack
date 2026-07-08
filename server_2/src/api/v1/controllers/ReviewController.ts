import { Request, Response, NextFunction } from 'express';
import { SubmitReview } from '../../../application/engagement/use-cases/SubmitReview';
import { GetMyReviews } from '../../../application/engagement/use-cases/GetMyReviews';
import { GetRestaurantReviews } from '../../../application/engagement/use-cases/GetRestaurantReviews';
import { GetRestaurantRating } from '../../../application/engagement/use-cases/GetRestaurantRating';
import { ModerateReview } from '../../../application/engagement/use-cases/ModerateReview';
import { ListPendingReviews } from '../../../application/engagement/use-cases/ListPendingReviews';
import { ModerationStatusValue } from '../../../domain/engagement/enums/moderation-status.enum';

export interface ReviewControllerDeps {
  submitReview: SubmitReview;
  getMyReviews: GetMyReviews;
  getRestaurantReviews: GetRestaurantReviews;
  getRestaurantRating: GetRestaurantRating;
  moderateReview: ModerateReview;
  listPendingReviews: ListPendingReviews;
}

export class ReviewController {
  constructor(private readonly deps: ReviewControllerDeps) {}

  submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.submitReview.execute({
      customerId: req.user!.userId,
      restaurantId: req.params.restaurantId as string,
      fulfillmentId: req.body.fulfillmentId,
      restaurantRating: req.body.restaurantRating,
      deliveryRating: req.body.deliveryRating,
      comment: req.body.comment,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(201).json(result.getValue());
  };

  getMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.getMyReviews.execute({
      customerId: req.user!.userId,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(200).json(result.getValue());
  };

  getForRestaurant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.getRestaurantReviews.execute({
      restaurantId: req.params.restaurantId as string,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(200).json(result.getValue());
  };

  getRating = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.getRestaurantRating.execute({
      restaurantId: req.params.restaurantId as string,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(200).json(result.getValue());
  };

  approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.moderateReview.execute({
      moderatorId: req.user!.userId,
      reviewId: req.params.id as string,
      action: 'APPROVE',
      reason: req.body.reason,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(200).json(result.getValue());
  };

  reject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.moderateReview.execute({
      moderatorId: req.user!.userId,
      reviewId: req.params.id as string,
      action: 'REJECT',
      reason: req.body.reason,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(200).json(result.getValue());
  };

  listPending = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await this.deps.listPendingReviews.execute({
      status: req.query.status as ModerationStatusValue | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    res.status(200).json(result.getValue());
  };
}
