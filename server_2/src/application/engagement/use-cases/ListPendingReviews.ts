// UC: ListPendingReviews — admin moderation queue (engagement_module.md §5). Defaults to PENDING;
// callers may request AUTO_FLAGGED. Lists across all restaurants via the moderation-status index.
import { Result } from '../../../domain/shared/Result';
import { MODERATION_STATUS } from '../../../domain/engagement/enums/moderation-status.enum';
import { IReviewRepository } from '../../../domain/engagement/repositories/IReviewRepository';
import { ListPendingReviewsDto } from '../dtos/ReviewDtos';
import { ReviewResponse, toReviewResponse } from '../responses/ReviewResponse';

export class ListPendingReviews {
  constructor(private readonly reviewRepo: IReviewRepository) {}

  async execute(dto: ListPendingReviewsDto): Promise<Result<ReviewResponse[]>> {
    const status = dto.status ?? MODERATION_STATUS.PENDING;
    const reviews = await this.reviewRepo.findByModerationStatus(status, { limit: dto.limit, offset: dto.offset });
    return Result.ok(reviews.map(toReviewResponse));
  }
}
