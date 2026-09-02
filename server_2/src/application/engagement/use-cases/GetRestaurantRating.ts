import { Result } from '../../../domain/shared/Result';
import { IReviewRepository } from '../../../domain/engagement/repositories/IReviewRepository';
import { GetRestaurantRatingDto } from '../dtos/ReviewDtos';
import { RestaurantRatingResponse, toRestaurantRatingResponse } from '../responses/RestaurantRatingResponse';

export class GetRestaurantRating {
  constructor(private readonly reviewRepo: IReviewRepository) {}

  async execute(dto: GetRestaurantRatingDto): Promise<Result<RestaurantRatingResponse>> {
    const rating = await this.reviewRepo.aggregateRating(dto.restaurantId);
    return Result.ok(toRestaurantRatingResponse(rating));
  }
}
