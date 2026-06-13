// Query: full-text menu-item search over the `menu_item_search` projection
// (Catalog Phase 10). Relevance ranking + dietary/availability/restaurant
// filters + cursor pagination are delegated to ISearchService (Mongo `$text`).
// Only items of PUBLIC + ACTIVE restaurants surface; `isAvailable` filters on the
// item's raw toggle as stored in the projection.
import { Result } from '../../../domain/shared/Result';
import { ISearchService } from '../../../domain/catalog/services/ISearchService';
import { CursorPage } from '../../../domain/catalog/types/CursorPagination';
import { MenuItemSearchView } from '../../../domain/catalog/types/ReadModels';
import { SearchMenuItemsDto } from '../dtos/QueryDtos';

export class SearchMenuItems {
  constructor(private readonly searchService: ISearchService) {}

  async execute(dto: SearchMenuItemsDto): Promise<Result<CursorPage<MenuItemSearchView>>> {
    const page = await this.searchService.searchItems(
      dto.query ?? '',
      { dietary: dto.dietary, isAvailable: dto.isAvailable, restaurantId: dto.restaurantId },
      { cursor: dto.cursor, limit: dto.limit }
    );
    return Result.ok(page);
  }
}
