// Query: restaurant profile card from the `restaurant_summary` projection.
// Projection-driven read only — never touches the write aggregate. Non-public /
// non-active / deleted restaurants are filtered by the read repository and surface
// here as NotFound.
import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ICatalogReadRepository } from '../../../domain/catalog/repositories/ICatalogReadRepository';
import { RestaurantSummaryView } from '../../../domain/catalog/types/ReadModels';
import { GetRestaurantDto } from '../dtos/QueryDtos';

export class GetRestaurant {
  constructor(private readonly readRepo: ICatalogReadRepository) {}

  async execute(dto: GetRestaurantDto): Promise<Result<RestaurantSummaryView>> {
    const summary = await this.readRepo.getRestaurantSummary(dto.restaurantId);
    if (!summary) return Result.fail(new NotFoundError('restaurant_not_found'));
    return Result.ok(summary);
  }
}
