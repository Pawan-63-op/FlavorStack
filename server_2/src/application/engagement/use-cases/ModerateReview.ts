import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { IReviewRepository } from '../../../domain/engagement/repositories/IReviewRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IEventBus } from '../../shared/events/IEventBus';
import { ModerateReviewDto } from '../dtos/ReviewDtos';
import { ReviewResponse, toReviewResponse } from '../responses/ReviewResponse';

/**
 * Moderation no longer recomputes a rating view: `GetRestaurantRating` aggregates the
 * APPROVED reviews on read, so approving (or rejecting) one is reflected immediately with
 * no second write to keep consistent.
 */
export class ModerateReview {
  constructor(
    private readonly reviewRepo: IReviewRepository,
    private readonly unitOfWork: IUnitOfWork,
    private readonly eventBus: IEventBus
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

    await this.unitOfWork.runInTransaction(async () => {
      await this.reviewRepo.update(review);
    });

    await this.eventBus.publishAll(events);

    return Result.ok(toReviewResponse(review));
  }
}
