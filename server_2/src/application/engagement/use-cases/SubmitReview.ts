import { Result } from '../../../domain/shared/Result';
import { ValidationError } from '../../../domain/shared/errors/ValidationError';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import { ConflictError } from '../../../domain/shared/errors/ConflictError';
import { Review } from '../../../domain/engagement/entities/Review';
import { IReviewRepository } from '../../../domain/engagement/repositories/IReviewRepository';
import { IReviewEligibilityRepository } from '../../../domain/engagement/repositories/IReviewEligibilityRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { SubmitReviewDto } from '../dtos/ReviewDtos';
import { ReviewResponse, toReviewResponse } from '../responses/ReviewResponse';

export class SubmitReview {
  constructor(
    private readonly reviewRepo: IReviewRepository,
    private readonly eligibilityRepo: IReviewEligibilityRepository,
    private readonly unitOfWork: IUnitOfWork,
    private readonly outboxStore: IOutboxStore,
    private readonly eventBus: IEventBus
  ) {}

  async execute(dto: SubmitReviewDto): Promise<Result<ReviewResponse>> {
    const eligibility = await this.eligibilityRepo.findByFulfillmentId(dto.fulfillmentId);
    if (!eligibility || !eligibility.deliveredAt) {
      return Result.fail(new ValidationError('review_not_eligible'));
    }
    if (eligibility.customerId !== dto.customerId) {
      return Result.fail(new ForbiddenError('review_not_owned'));
    }
    if (eligibility.restaurantId !== dto.restaurantId) {
      return Result.fail(new ValidationError('review_restaurant_mismatch'));
    }
    if (eligibility.reviewed) {
      return Result.fail(new ConflictError('review_already_submitted'));
    }

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

    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.reviewRepo.save(review);
      if (events.length > 0) await this.outboxStore.append(events, ctx);
      await this.eligibilityRepo.markReviewed(dto.fulfillmentId);
    });

    await this.eventBus.publishAll(events);

    return Result.ok(toReviewResponse(review));
  }
}
