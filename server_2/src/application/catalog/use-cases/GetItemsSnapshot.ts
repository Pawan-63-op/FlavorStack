// Query: raw item price/availability snapshot by id — the Cart/Order contract
// (Catalog ↔ Commerce). Returns stored item state regardless of restaurant
// open-state, so Commerce can revalidate carts against Catalog's source of truth.
import { Result } from '../../../domain/shared/Result';
import { ICatalogReadRepository } from '../../../domain/catalog/repositories/ICatalogReadRepository';
import { MenuItemView } from '../../../domain/catalog/types/ReadModels';
import { GetItemsSnapshotDto } from '../dtos/QueryDtos';

export class GetItemsSnapshot {
  constructor(private readonly readRepo: ICatalogReadRepository) {}

  async execute(dto: GetItemsSnapshotDto): Promise<Result<MenuItemView[]>> {
    const items = await this.readRepo.getItemsSnapshot(dto.itemIds);
    return Result.ok(items);
  }
}
