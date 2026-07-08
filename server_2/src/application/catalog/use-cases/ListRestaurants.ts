import { Result } from '../../../domain/shared/Result';
import { ICatalogReadRepository } from '../../../domain/catalog/repositories/ICatalogReadRepository';
import { CursorPage } from '../../../domain/catalog/types/CursorPagination';
import { RestaurantSummaryView } from '../../../domain/catalog/types/ReadModels';
import { ListRestaurantsDto } from '../dtos/QueryDtos';

export class ListRestaurants {
  constructor(private readonly readRepo: ICatalogReadRepository) {}

  async execute(dto: ListRestaurantsDto): Promise<Result<CursorPage<RestaurantSummaryView>>> {
    const page = await this.readRepo.listRestaurantSummaries(
      { cuisineTypes: dto.cuisineTypes, isOpen: dto.isOpen },
      { cursor: dto.cursor, limit: dto.limit }
    );
    return Result.ok(page);
  }
}
