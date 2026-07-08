import { Result } from '../../../domain/shared/Result';
import { MODERATION_STATUS } from '../../../domain/engagement/enums/moderation-status.enum';
import { IReviewRepository } from '../../../domain/engagement/repositories/IReviewRepository';
import {
  IRestaurantRatingViewRepository,
  RestaurantRatingDistribution,
} from '../../../domain/engagement/repositories/IRestaurantRatingViewRepository';
import { RecomputeRestaurantRatingDto } from '../dtos/ReviewDtos';

export class RecomputeRestaurantRating {
  constructor(
    private readonly reviewRepo: IReviewRepository,
    private readonly ratingViewRepo: IRestaurantRatingViewRepository
  ) {}

  async execute(dto: RecomputeRestaurantRatingDto): Promise<Result<void>> {
    const reviews = await this.reviewRepo.findByRestaurant(dto.restaurantId, MODERATION_STATUS.APPROVED);

    const distribution: RestaurantRatingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const review of reviews) {
      const value = review.restaurantRating.value as 1 | 2 | 3 | 4 | 5;
      distribution[value] += 1;
      sum += value;
    }

    const reviewCount = reviews.length;
    const avgRating = reviewCount === 0 ? 0 : Math.round((sum / reviewCount) * 100) / 100;

    await this.ratingViewRepo.upsert({
      restaurantId: dto.restaurantId,
      avgRating,
      reviewCount,
      distribution,
      updatedAt: new Date(),
    });

    return Result.ok(undefined);
  }
}
