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
