import { Result } from '../../../domain/shared/Result';
import { ISearchService } from '../../../domain/catalog/services/ISearchService';
import { CursorPage } from '../../../domain/catalog/types/CursorPagination';
import { RestaurantSummaryView } from '../../../domain/catalog/types/ReadModels';
import { SearchRestaurantsDto } from '../dtos/QueryDtos';

export class SearchRestaurants {
  constructor(private readonly searchService: ISearchService) {}

  async execute(dto: SearchRestaurantsDto): Promise<Result<CursorPage<RestaurantSummaryView>>> {
    const page = await this.searchService.searchRestaurants(
      dto.query ?? '',
      { cuisineTypes: dto.cuisineTypes, isOpenNow: dto.isOpenNow },
      { cursor: dto.cursor, limit: dto.limit }
    );
    return Result.ok(page);
  }
}
