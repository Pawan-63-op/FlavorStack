import { ICatalogGateway } from '../../domain/commerce/services/ICatalogGateway';
import {
  CartMenuItemView,
  CartRestaurantView,
  CheckoutRestaurant,
  CheckoutMenuItem,
  CheckoutServiceability,
} from '../../domain/commerce/types/CatalogGatewayRead';
import {
  COMMERCE_RESTAURANT_STATUS,
  CommerceRestaurantStatus,
} from '../../domain/commerce/enums/restaurant-status.enum';
import { Result } from '../../domain/shared/Result';
import { Money } from '../../domain/shared/Money';
import { NotFoundError } from '../../domain/shared/errors/NotFoundError';
import { ValidationError } from '../../domain/shared/errors/ValidationError';
import { GeoPoint } from '../../domain/identity/value-objects/GeoPoint.vo';
import { ICatalogReadRepository } from '../../domain/catalog/repositories/ICatalogReadRepository';
import { ICatalogQueryRepository } from '../../domain/catalog/repositories/ICatalogQueryRepository';
import {
  CatalogQueryMenuItem,
  CatalogQueryRestaurant,
} from '../../domain/catalog/types/QueryModels';
import { IOpeningHoursService } from '../../domain/catalog/services/IOpeningHoursService';
import { MenuItemView, ServiceableRestaurantView } from '../../domain/catalog/types/ReadModels';
import { RestaurantStatus } from '../../domain/catalog/enums/restaurant-status.enum';
import { CheckServiceabilityDto } from '../../application/catalog/dtos/QueryDtos';

/** Narrow port over Catalog's `CheckServiceability` use case (which satisfies it structurally), so
 *  the gateway depends on a query contract rather than the concrete class — and stays unit-testable. */
export interface ICatalogServiceabilityQuery {
  execute(dto: CheckServiceabilityDto): Promise<Result<ServiceableRestaurantView[]>>;
}

const STATUS_MAP: Record<RestaurantStatus, CommerceRestaurantStatus> = {
  DRAFT: COMMERCE_RESTAURANT_STATUS.DRAFT,
  ACTIVE: COMMERCE_RESTAURANT_STATUS.ACTIVE,
  PAUSED: COMMERCE_RESTAURANT_STATUS.PAUSED,
  CLOSED: COMMERCE_RESTAURANT_STATUS.CLOSED,
};

export class CatalogGateway implements ICatalogGateway {
  constructor(
    private readonly readRepo: ICatalogReadRepository,
    private readonly serviceabilityQuery: ICatalogServiceabilityQuery,
    private readonly openingHours: IOpeningHoursService,
    private readonly queryRepo: ICatalogQueryRepository
  ) {}

  async getRestaurantForCheckout(restaurantId: string): Promise<Result<CheckoutRestaurant>> {
    const summary = await this.readRepo.getRestaurantSummary(restaurantId);
    if (!summary) {
      return Result.fail(new NotFoundError(`Restaurant ${restaurantId} is not available for checkout`));
    }

    const status = STATUS_MAP[summary.status];
    if (!status) {
      return Result.fail(new ValidationError(`Unknown restaurant status "${summary.status}" from Catalog`));
    }

    return Result.ok<CheckoutRestaurant>({
      restaurantId: summary.id,
      name: summary.name,
      status,
      isOpen: summary.isOpen,
    });
  }

  async getItemsSnapshot(menuItemIds: string[]): Promise<Result<CheckoutMenuItem[]>> {
    const views = await this.readRepo.getItemsSnapshot(menuItemIds);

    const items: CheckoutMenuItem[] = [];
    for (const view of views) {
      const mapped = this.toCheckoutMenuItem(view);
      if (mapped.isFailure) return Result.fail(mapped.getError());
      items.push(mapped.getValue());
    }

    return Result.ok(items);
  }

  async checkServiceability(
    restaurantId: string,
    point: GeoPoint,
    subtotal: Money
  ): Promise<Result<CheckoutServiceability>> {
    const dto: CheckServiceabilityDto = {
      lat: point.lat,
      lng: point.lng,
      subtotalAmount: subtotal.amount,
      currency: subtotal.currency,
    };

    const result = await this.serviceabilityQuery.execute(dto);
    if (result.isFailure) return Result.fail(result.getError());

    const match = result.getValue().find((v) => v.restaurantId === restaurantId);
    if (!match) {
      const zero = Money.create(0, subtotal.currency);
      if (zero.isFailure) return Result.fail(zero.getError());
      return Result.ok<CheckoutServiceability>({
        serviceable: false,
        distanceMeters: 0,
        deliveryFee: zero.getValue(),
        minOrder: zero.getValue(),
      });
    }

    const deliveryFee = Money.create(match.deliveryFee.amount, match.deliveryFee.currency);
    if (deliveryFee.isFailure) return Result.fail(deliveryFee.getError());
    const minOrder = Money.create(match.minOrder.amount, match.minOrder.currency);
    if (minOrder.isFailure) return Result.fail(minOrder.getError());

    return Result.ok<CheckoutServiceability>({
      serviceable: true,
      distanceMeters: match.distanceMeters,
      deliveryFee: deliveryFee.getValue(),
      minOrder: minOrder.getValue(),
    });
  }

  async isRestaurantOpen(restaurantId: string, at?: Date): Promise<Result<boolean>> {
    const open = await this.openingHours.isRestaurantOpen(restaurantId, at);
    return Result.ok(open);
  }

  async getRestaurantForCart(restaurantId: string): Promise<Result<CartRestaurantView | null>> {
    const restaurant = await this.queryRepo.findRestaurantById(restaurantId);
    return Result.ok(restaurant ? this.toCartRestaurant(restaurant) : null);
  }

  async getItemsForCart(menuItemIds: string[]): Promise<Result<CartMenuItemView[]>> {
    const items = await this.queryRepo.findMenuItemsByIds(menuItemIds);
    return Result.ok(items.map((item) => this.toCartMenuItem(item)));
  }

  private toCartRestaurant(restaurant: CatalogQueryRestaurant): CartRestaurantView {
    return {
      restaurantId: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      status: restaurant.status,
      visibility: restaurant.visibility,
      openingHours: restaurant.openingHours
        ? {
            schedule: restaurant.openingHours.schedule,
            holidays: [...restaurant.openingHours.holidays],
          }
        : null,
      tzOffsetMinutes: 0,
      deliveryZones: restaurant.deliveryZones.map((zone) => ({
        deliveryZoneId: zone.id,
        feeTiers: zone.feeTiers.map((tier) => ({
          maxDistanceMeters: tier.maxDistanceMeters,
          feeAmount: tier.fee.amount,
          currency: tier.fee.currency,
        })),
        freeAboveSubtotalAmount: zone.freeAboveSubtotal?.amount ?? null,
        minOrderAmount: zone.minOrder.amount,
        currency: zone.minOrder.currency,
      })),
    };
  }

  private toCartMenuItem(item: CatalogQueryMenuItem): CartMenuItemView {
    return {
      menuItemId: item.id,
      restaurantId: item.restaurantId,
      categoryId: item.categoryId,
      name: item.name,
      basePriceAmount: item.basePrice.amount,
      currency: item.basePrice.currency,
      variantGroups: item.variantGroups.map((group) => ({
        groupId: group.id,
        label: group.label,
        selectionType: group.selectionType,
        required: group.required,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        options: group.options.map((option) => ({
          optionId: option.id,
          label: option.label,
          priceDeltaAmount: option.priceDelta.amount,
          currency: option.priceDelta.currency,
          isDefault: option.isDefault,
          isAvailable: option.isAvailable,
        })),
      })),
      isAvailable: item.isAvailable,
      outOfStockReason: item.outOfStockReason,
    };
  }

  private toCheckoutMenuItem(view: MenuItemView): Result<CheckoutMenuItem> {
    const basePrice = Money.create(view.basePriceAmount, view.currency);
    if (basePrice.isFailure) return Result.fail(basePrice.getError());

    return Result.ok<CheckoutMenuItem>({
      menuItemId: view.id,
      restaurantId: view.restaurantId,
      name: view.name,
      categoryId: view.categoryId,
      basePrice: basePrice.getValue(),
      isAvailable: view.isAvailable,
    });
  }
}
