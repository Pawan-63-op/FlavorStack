import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { Money } from '../../../domain/shared/Money';
import { ItemOption } from '../../../domain/catalog/entities/ItemOption';
import { ItemVariantGroup } from '../../../domain/catalog/entities/ItemVariantGroup';
import { IRestaurantRepository } from '../../../domain/catalog/repositories/IRestaurantRepository';
import { IMenuItemRepository } from '../../../domain/catalog/repositories/IMenuItemRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IEventBus } from '../../shared/events/IEventBus';
import { SetItemVariantsDto } from '../dtos/SetItemVariantsDto';
import { MenuItemResponse } from '../responses/MenuItemResponse';
import { toMenuItemResponse } from '../responses/mappers';
import { assertRestaurantOwnership } from './shared/ownership';

/** Owner (or super-admin) write: replaces a menu item's variant groups and options. */
export class SetItemVariants {
  constructor(
    private restaurantRepo: IRestaurantRepository,
    private menuItemRepo: IMenuItemRepository,
    private unitOfWork: IUnitOfWork,
    private eventBus: IEventBus
  ) {}

  async execute(dto: SetItemVariantsDto): Promise<Result<MenuItemResponse>> {
    const menuItem = await this.menuItemRepo.findById(dto.itemId);
    if (!menuItem) return Result.fail(new NotFoundError('menu_item_not_found'));

    const restaurant = await this.restaurantRepo.findById(menuItem.restaurantId);
    if (!restaurant) return Result.fail(new NotFoundError('restaurant_not_found'));

    const ownership = assertRestaurantOwnership(restaurant, dto);
    if (ownership.isFailure) return Result.fail(ownership.getError());

    const groups: ItemVariantGroup[] = [];
    for (const groupInput of dto.groups) {
      const options: ItemOption[] = [];
      for (const optionInput of groupInput.options ?? []) {
        const priceResult = Money.create(optionInput.priceDelta.amount, optionInput.priceDelta.currency);
        if (priceResult.isFailure) return Result.fail(priceResult.getError());

        const optionResult = ItemOption.create({
          label: optionInput.label,
          priceDelta: priceResult.getValue(),
          isDefault: optionInput.isDefault,
          isAvailable: optionInput.isAvailable,
        });
        if (optionResult.isFailure) return Result.fail(optionResult.getError());

        options.push(optionResult.getValue());
      }

      const groupResult = ItemVariantGroup.create({
        label: groupInput.label,
        selectionType: groupInput.selectionType,
        required: groupInput.required,
        minSelect: groupInput.minSelect,
        maxSelect: groupInput.maxSelect,
        options,
      });
      if (groupResult.isFailure) return Result.fail(groupResult.getError());

      groups.push(groupResult.getValue());
    }

    const setResult = menuItem.setItemVariants(groups);
    if (setResult.isFailure) return Result.fail(setResult.getError());

    const events = menuItem.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async () => {
      await this.menuItemRepo.update(menuItem);
    });

    await this.eventBus.publishAll(events);

    return Result.ok(toMenuItemResponse(menuItem));
  }
}
