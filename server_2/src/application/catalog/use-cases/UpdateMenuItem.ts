import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { Money } from '../../../domain/shared/Money';
import { IRestaurantRepository } from '../../../domain/catalog/repositories/IRestaurantRepository';
import { IMenuItemRepository } from '../../../domain/catalog/repositories/IMenuItemRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IEventBus } from '../../shared/events/IEventBus';
import { UpdateMenuItemDto } from '../dtos/UpdateMenuItemDto';
import { MenuItemResponse } from '../responses/MenuItemResponse';
import { toMenuItemResponse } from '../responses/mappers';
import { assertRestaurantOwnership } from './shared/ownership';

/** Owner (or super-admin) write: updates menu item details, price, and/or category. */
export class UpdateMenuItem {
  constructor(
    private restaurantRepo: IRestaurantRepository,
    private menuItemRepo: IMenuItemRepository,
    private unitOfWork: IUnitOfWork,
    private eventBus: IEventBus
  ) {}

  async execute(dto: UpdateMenuItemDto): Promise<Result<MenuItemResponse>> {
    const menuItem = await this.menuItemRepo.findById(dto.itemId);
    if (!menuItem) return Result.fail(new NotFoundError('menu_item_not_found'));

    const restaurant = await this.restaurantRepo.findById(menuItem.restaurantId);
    if (!restaurant) return Result.fail(new NotFoundError('restaurant_not_found'));

    const ownership = assertRestaurantOwnership(restaurant, dto);
    if (ownership.isFailure) return Result.fail(ownership.getError());

    if (dto.categoryId !== undefined) {
      const category = restaurant.categories.find((c) => c.id.toString() === dto.categoryId);
      if (!category) return Result.fail(new NotFoundError('category_not_found'));
    }

    const detailsResult = menuItem.updateDetails({
      name: dto.name,
      description: dto.description,
      imageUrl: dto.imageUrl,
      tags: dto.tags,
      dietary: dto.dietary,
    });
    if (detailsResult.isFailure) return Result.fail(detailsResult.getError());

    if (dto.price !== undefined) {
      const priceResult = Money.create(dto.price.amount, dto.price.currency);
      if (priceResult.isFailure) return Result.fail(priceResult.getError());

      const changePriceResult = menuItem.changePrice(priceResult.getValue());
      if (changePriceResult.isFailure) return Result.fail(changePriceResult.getError());
    }

    if (dto.categoryId !== undefined) {
      const assignResult = menuItem.assignCategory(dto.categoryId);
      if (assignResult.isFailure) return Result.fail(assignResult.getError());
    }

    const events = menuItem.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async () => {
      await this.menuItemRepo.update(menuItem);
    });

    await this.eventBus.publishAll(events);

    return Result.ok(toMenuItemResponse(menuItem));
  }
}
