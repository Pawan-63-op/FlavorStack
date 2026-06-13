import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { Money } from '../../../domain/shared/Money';
import { MenuItem } from '../../../domain/catalog/entities/MenuItem';
import { IRestaurantRepository } from '../../../domain/catalog/repositories/IRestaurantRepository';
import { IMenuItemRepository } from '../../../domain/catalog/repositories/IMenuItemRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { AddMenuItemDto } from '../dtos/AddMenuItemDto';
import { MenuItemResponse } from '../responses/MenuItemResponse';
import { toMenuItemResponse } from '../responses/mappers';
import { assertRestaurantOwnership } from './shared/ownership';

/** Owner (or super-admin) write: creates a new menu item under an existing category. */
export class AddMenuItem {
  constructor(
    private restaurantRepo: IRestaurantRepository,
    private menuItemRepo: IMenuItemRepository,
    private unitOfWork: IUnitOfWork,
    private outboxStore: IOutboxStore,
    private eventBus: IEventBus
  ) {}

  async execute(dto: AddMenuItemDto): Promise<Result<MenuItemResponse>> {
    const restaurant = await this.restaurantRepo.findById(dto.restaurantId);
    if (!restaurant) return Result.fail(new NotFoundError('restaurant_not_found'));

    const ownership = assertRestaurantOwnership(restaurant, dto);
    if (ownership.isFailure) return Result.fail(ownership.getError());

    const category = restaurant.categories.find((c) => c.id.toString() === dto.categoryId);
    if (!category) return Result.fail(new NotFoundError('category_not_found'));

    const priceResult = Money.create(dto.basePrice.amount, dto.basePrice.currency);
    if (priceResult.isFailure) return Result.fail(priceResult.getError());

    const menuItemResult = MenuItem.create({
      restaurantId: dto.restaurantId,
      categoryId: dto.categoryId,
      name: dto.name,
      description: dto.description,
      imageUrl: dto.imageUrl,
      basePrice: priceResult.getValue(),
      tags: dto.tags,
      dietary: dto.dietary,
    });
    if (menuItemResult.isFailure) return Result.fail(menuItemResult.getError());

    const menuItem = menuItemResult.getValue();
    const events = menuItem.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.menuItemRepo.save(menuItem);
      if (events.length > 0) {
        await this.outboxStore.append(events, ctx);
      }
    });

    await this.eventBus.publishAll(events);

    return Result.ok(toMenuItemResponse(menuItem));
  }
}
