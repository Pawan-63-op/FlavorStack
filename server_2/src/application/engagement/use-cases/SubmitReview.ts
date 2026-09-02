import { Result } from '../../../domain/shared/Result';
import { ValidationError } from '../../../domain/shared/errors/ValidationError';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import { ConflictError } from '../../../domain/shared/errors/ConflictError';
import { Review } from '../../../domain/engagement/entities/Review';
import { IReviewRepository } from '../../../domain/engagement/repositories/IReviewRepository';
import { IFulfillmentGateway } from '../../../domain/engagement/services/IFulfillmentGateway';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IEventBus } from '../../shared/events/IEventBus';
import { SubmitReviewDto } from '../dtos/ReviewDtos';
import { ReviewResponse, toReviewResponse } from '../responses/ReviewResponse';

export class SubmitReview {
  constructor(
    private readonly reviewRepo: IReviewRepository,
    private readonly fulfillmentGateway: IFulfillmentGateway,
    private readonly unitOfWork: IUnitOfWork,
    private readonly eventBus: IEventBus
  ) {}

  async execute(dto: SubmitReviewDto): Promise<Result<ReviewResponse>> {
    // Eligibility is read from the fulfillment aggregate rather than a replicated
    // `reviewed` flag, so there is no window in which the two disagree.
    const subject = await this.fulfillmentGateway.getForReview(dto.fulfillmentId);
    if (!subject || !subject.deliveredAt) {
      return Result.fail(new ValidationError('review_not_eligible'));
    }
    if (subject.customerId !== dto.customerId) {
      return Result.fail(new ForbiddenError('review_not_owned'));
    }
    if (subject.restaurantId !== dto.restaurantId) {
      return Result.fail(new ValidationError('review_restaurant_mismatch'));
    }

    // "Already reviewed" is now a lookup on `reviews` itself, under the unique
    // {customerId, fulfillmentId} index that is also the race-safe backstop: a concurrent
    // second submit passes this check but fails the insert with a ConflictError.
    const existing = await this.reviewRepo.findByCustomerAndFulfillment(dto.customerId, dto.fulfillmentId);
    if (existing) {
      return Result.fail(new ConflictError('review_already_submitted'));
    }

    const reviewResult = Review.submit({
      customerId: dto.customerId,
      restaurantId: dto.restaurantId,
      fulfillmentId: dto.fulfillmentId,
      restaurantRating: dto.restaurantRating,
      deliveryRating: dto.deliveryRating,
      comment: dto.comment,
    });
    if (reviewResult.isFailure) return Result.fail(reviewResult.getError());

    const review = reviewResult.getValue();
    const events = review.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async () => {
      await this.reviewRepo.save(review);
    });

    await this.eventBus.publishAll(events);

    return Result.ok(toReviewResponse(review));
  }
}
