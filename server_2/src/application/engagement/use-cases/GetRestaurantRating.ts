import { Result } from '../../../domain/shared/Result';
import { IRestaurantRatingViewRepository } from '../../../domain/engagement/repositories/IRestaurantRatingViewRepository';
import { GetRestaurantRatingDto } from '../dtos/ReviewDtos';
import { RestaurantRatingResponse, toRestaurantRatingResponse } from '../responses/RestaurantRatingResponse';

export class GetRestaurantRating {
  constructor(private readonly ratingViewRepo: IRestaurantRatingViewRepository) {}

  async execute(dto: GetRestaurantRatingDto): Promise<Result<RestaurantRatingResponse>> {
    const view = await this.ratingViewRepo.findByRestaurantId(dto.restaurantId);
    return Result.ok(toRestaurantRatingResponse(dto.restaurantId, view));
  }
}
