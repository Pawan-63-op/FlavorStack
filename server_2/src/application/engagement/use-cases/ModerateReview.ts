// UC: ModerateReview — admin approves or rejects a review (engagement_module.md §4).
// On approve, raises ReviewModerated and triggers RecomputeRestaurantRating (only approved reviews
// contribute to the aggregate). Canonical write shape: domain method → pullDomainEvents →
// runInTransaction(update + outbox) → publishAll.
import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { IReviewRepository } from '../../../domain/engagement/repositories/IReviewRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { ModerateReviewDto } from '../dtos/ReviewDtos';
import { ReviewResponse, toReviewResponse } from '../responses/ReviewResponse';
import { RecomputeRestaurantRating } from './RecomputeRestaurantRating';

export class ModerateReview {
  constructor(
    private readonly reviewRepo: IReviewRepository,
    private readonly unitOfWork: IUnitOfWork,
    private readonly outboxStore: IOutboxStore,
    private readonly eventBus: IEventBus,
    private readonly recomputeRestaurantRating: RecomputeRestaurantRating
  ) {}

  async execute(dto: ModerateReviewDto): Promise<Result<ReviewResponse>> {
    const review = await this.reviewRepo.findById(dto.reviewId);
    if (!review) return Result.fail(new NotFoundError('review_not_found'));

    const moderation =
      dto.action === 'APPROVE'
        ? review.approve(dto.moderatorId)
        : review.reject(dto.moderatorId, dto.reason ?? '');
    if (moderation.isFailure) return Result.fail(moderation.getError());

    const events = review.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.reviewRepo.update(review);
      if (events.length > 0) await this.outboxStore.append(events, ctx);
    });

    await this.eventBus.publishAll(events);

    if (dto.action === 'APPROVE') {
      await this.recomputeRestaurantRating.execute({ restaurantId: review.restaurantId });
    }

    return Result.ok(toReviewResponse(review));
  }
}
