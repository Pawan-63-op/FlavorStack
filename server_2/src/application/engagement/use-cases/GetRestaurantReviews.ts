// UC: GetRestaurantReviews — public, approved-only, paginated (engagement_module.md §5).
import { Result } from '../../../domain/shared/Result';
import { MODERATION_STATUS } from '../../../domain/engagement/enums/moderation-status.enum';
import { IReviewRepository } from '../../../domain/engagement/repositories/IReviewRepository';
import { GetRestaurantReviewsDto } from '../dtos/ReviewDtos';
import { ReviewResponse, toReviewResponse } from '../responses/ReviewResponse';

export class GetRestaurantReviews {
  constructor(private readonly reviewRepo: IReviewRepository) {}

  async execute(dto: GetRestaurantReviewsDto): Promise<Result<ReviewResponse[]>> {
    const reviews = await this.reviewRepo.findByRestaurant(dto.restaurantId, MODERATION_STATUS.APPROVED, {
      limit: dto.limit,
      offset: dto.offset,
    });
    return Result.ok(reviews.map(toReviewResponse));
  }
}
