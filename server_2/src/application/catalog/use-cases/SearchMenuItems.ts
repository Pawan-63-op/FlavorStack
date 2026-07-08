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
