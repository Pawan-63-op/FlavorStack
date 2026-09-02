import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ItemAvailability } from '../../../domain/catalog/value-objects/ItemAvailability.vo';
import { IRestaurantRepository } from '../../../domain/catalog/repositories/IRestaurantRepository';
import { IMenuItemRepository } from '../../../domain/catalog/repositories/IMenuItemRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IEventBus } from '../../shared/events/IEventBus';
import { ToggleMenuItemAvailabilityDto } from '../dtos/ToggleMenuItemAvailabilityDto';
import { MenuItemResponse } from '../responses/MenuItemResponse';
import { toMenuItemResponse } from '../responses/mappers';
import { assertRestaurantOwnership } from './shared/ownership';

/** Owner (or super-admin) write: toggles a menu item's availability window/reason. */
export class ToggleMenuItemAvailability {
  constructor(
    private restaurantRepo: IRestaurantRepository,
    private menuItemRepo: IMenuItemRepository,
    private unitOfWork: IUnitOfWork,
    private eventBus: IEventBus
  ) {}

  async execute(dto: ToggleMenuItemAvailabilityDto): Promise<Result<MenuItemResponse>> {
    const menuItem = await this.menuItemRepo.findById(dto.itemId);
    if (!menuItem) return Result.fail(new NotFoundError('menu_item_not_found'));

    const restaurant = await this.restaurantRepo.findById(menuItem.restaurantId);
    if (!restaurant) return Result.fail(new NotFoundError('restaurant_not_found'));

    const ownership = assertRestaurantOwnership(restaurant, dto);
    if (ownership.isFailure) return Result.fail(ownership.getError());

    const availabilityResult = ItemAvailability.create({
      isAvailable: dto.isAvailable,
      availableFrom: dto.availableFrom,
      availableUntil: dto.availableUntil,
      outOfStockReason: dto.outOfStockReason,
    });
    if (availabilityResult.isFailure) return Result.fail(availabilityResult.getError());

    const toggleResult = menuItem.toggleAvailability(availabilityResult.getValue());
    if (toggleResult.isFailure) return Result.fail(toggleResult.getError());

    const events = menuItem.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async () => {
      await this.menuItemRepo.update(menuItem);
    });

    await this.eventBus.publishAll(events);

    return Result.ok(toMenuItemResponse(menuItem));
  }
}
