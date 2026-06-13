import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { IRestaurantRepository } from '../../../domain/catalog/repositories/IRestaurantRepository';
import { IMenuItemRepository } from '../../../domain/catalog/repositories/IMenuItemRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { RemoveMenuItemDto } from '../dtos/RemoveMenuItemDto';
import { assertRestaurantOwnership } from './shared/ownership';

/** Owner (or super-admin) write: soft-deletes a menu item. */
export class RemoveMenuItem {
  constructor(
    private restaurantRepo: IRestaurantRepository,
    private menuItemRepo: IMenuItemRepository,
    private unitOfWork: IUnitOfWork
  ) {}

  async execute(dto: RemoveMenuItemDto): Promise<Result<void>> {
    const menuItem = await this.menuItemRepo.findById(dto.itemId);
    if (!menuItem) return Result.fail(new NotFoundError('menu_item_not_found'));

    const restaurant = await this.restaurantRepo.findById(menuItem.restaurantId);
    if (!restaurant) return Result.fail(new NotFoundError('restaurant_not_found'));

    const ownership = assertRestaurantOwnership(restaurant, dto);
    if (ownership.isFailure) return Result.fail(ownership.getError());

    const softDeleteResult = menuItem.softDelete();
    if (softDeleteResult.isFailure) return Result.fail(softDeleteResult.getError());

    await this.unitOfWork.runInTransaction(async () => {
      await this.menuItemRepo.softDelete(menuItem.id.toString());
    });

    return Result.ok();
  }
}
