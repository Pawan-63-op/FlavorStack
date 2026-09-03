import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ICatalogReadRepository } from '../../../domain/catalog/repositories/ICatalogReadRepository';
import { MenuItemDetailView } from '../../../domain/catalog/types/ReadModels';
import { GetMenuItemDto } from '../dtos/QueryDtos';

export class GetMenuItem {
  constructor(private readonly readRepo: ICatalogReadRepository) {}

  async execute(dto: GetMenuItemDto): Promise<Result<MenuItemDetailView>> {
    const item = await this.readRepo.getMenuItemView(dto.itemId);
    if (!item) return Result.fail(new NotFoundError('menu_item_not_found'));
    return Result.ok(item);
  }
}
