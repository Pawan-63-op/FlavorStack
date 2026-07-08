import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ICatalogReadRepository } from '../../../domain/catalog/repositories/ICatalogReadRepository';
import { RestaurantMenuView } from '../../../domain/catalog/types/ReadModels';
import { GetRestaurantMenuDto } from '../dtos/QueryDtos';

export class GetRestaurantMenu {
  constructor(private readonly readRepo: ICatalogReadRepository) {}

  async execute(dto: GetRestaurantMenuDto): Promise<Result<RestaurantMenuView>> {
    const menu = await this.readRepo.getRestaurantMenu(dto.restaurantId);
    if (!menu) return Result.fail(new NotFoundError('restaurant_not_found'));
    return Result.ok(menu);
  }
}
