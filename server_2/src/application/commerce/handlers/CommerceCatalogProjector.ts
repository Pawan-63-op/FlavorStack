// CommerceCatalogProjector — keeps the commerce_catalog_view local projection in
// sync with Catalog (Commerce Phase 5). Mirrors CatalogProjector's "rebuild
// wholesale from source aggregates" strategy: on any restaurant- or item-affecting
// catalog event, reload the restaurant + its menu items via Catalog's read-only
// domain repositories and rebuild that restaurant's commerce_catalog_view entry.
//
// Idempotency: every event is checkpointed by `eventId` via
// `ICommerceCatalogReadRepository.markEventProcessed` before any read/write happens,
// so at-least-once redelivery (outbox -> QUEUE.commerce) is a safe no-op.
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { Restaurant } from '../../../domain/catalog/entities/Restaurant';
import { MenuItem } from '../../../domain/catalog/entities/MenuItem';
import { IRestaurantRepository } from '../../../domain/catalog/repositories/IRestaurantRepository';
import { IMenuItemRepository } from '../../../domain/catalog/repositories/IMenuItemRepository';
import { ICommerceCatalogReadRepository } from '../../../domain/commerce/repositories/ICommerceCatalogReadRepository';
import { CommerceCatalogRestaurantView } from '../../../domain/commerce/types/CommerceCatalogView';
import { CommerceTelemetry } from '../observability/CommerceTelemetry';

const ITEM_PAGE_LIMIT = 100;

/** Maps a Restaurant aggregate + its menu items to a commerce_catalog_view entry. */
export function toCommerceCatalogRestaurantView(
  restaurant: Restaurant,
  items: MenuItem[]
): CommerceCatalogRestaurantView {
  const openingHours = restaurant.openingHours;

  return {
    restaurantId: restaurant.id.toString(),
    name: restaurant.name,
    slug: restaurant.slug,
    status: restaurant.status.value,
    visibility: restaurant.visibility.value,
    openingHours: openingHours
      ? { schedule: openingHours.schedule, holidays: [...openingHours.holidays] }
      : null,
    tzOffsetMinutes: 0,
    deliveryZones: restaurant.deliveryZones.map((zone) => ({
      deliveryZoneId: zone.id.toString(),
      feeTiers: zone.feeMatrix.tiers.map((tier) => ({
        maxDistanceMeters: tier.maxDistanceMeters,
        feeAmount: tier.fee.amount,
        currency: tier.fee.currency,
      })),
      freeAboveSubtotalAmount: zone.feeMatrix.freeAboveSubtotal?.amount ?? null,
      minOrderAmount: zone.minOrder.amount,
      currency: zone.minOrder.currency,
    })),
    items: items.map((item) => ({
      menuItemId: item.id.toString(),
      categoryId: item.categoryId,
      name: item.name,
      basePriceAmount: item.basePrice.amount,
      currency: item.basePrice.currency,
      variantGroups: item.variantGroups.map((group) => ({
        groupId: group.id.toString(),
        label: group.label,
        selectionType: group.selectionType,
        required: group.required,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        options: group.options.map((option) => ({
          optionId: option.id.toString(),
          label: option.label,
          priceDeltaAmount: option.priceDelta.amount,
          currency: option.priceDelta.currency,
          isDefault: option.isDefault,
          isAvailable: option.isAvailable,
        })),
      })),
      isAvailable: item.availability.isAvailable,
      outOfStockReason: item.availability.outOfStockReason ?? null,
    })),
    updatedAt: new Date(),
  };
}

export class CommerceCatalogProjector {
  constructor(
    private readonly restaurantRepo: IRestaurantRepository,
    private readonly menuItemRepo: IMenuItemRepository,
    private readonly projectionRepo: ICommerceCatalogReadRepository,
    private readonly telemetry: CommerceTelemetry = new CommerceTelemetry()
  ) {}

  // ── event reactions ──────────────────────────────────────────

  /** RestaurantUpdated / RestaurantStatusChanged — aggregateId IS the restaurantId. */
  async onRestaurantEvent(event: DomainEvent): Promise<void> {
    await this.rebuild(event.aggregateId, event);
  }

  /** MenuItemAvailabilityChanged — carries `restaurantId`. */
  async onMenuItemEvent(event: DomainEvent & { restaurantId: string }): Promise<void> {
    await this.rebuild(event.restaurantId, event);
  }

  /** MenuItemUpdated — only the item id is known; resolve its restaurant. */
  async onMenuItemUpdated(event: DomainEvent): Promise<void> {
    const item = await this.menuItemRepo.findById(event.aggregateId);
    if (!item) return; // deleted/unknown — a later restaurant event will reconcile
    await this.rebuild(item.restaurantId, event);
  }

  // ── rebuild core ─────────────────────────────────────────────

  /**
   * Rebuild the commerce_catalog_view entry for a restaurant from source aggregates,
   * or tombstone it if the restaurant no longer exists. Checkpointed by `eventId`
   * first so redelivered events are a no-op.
   */
  async rebuild(restaurantId: string, event: DomainEvent): Promise<void> {
    const isNew = await this.projectionRepo.markEventProcessed(event.eventId, event.eventName, restaurantId);
    if (!isNew) return;

    // Phase 14: projection lag = time from the catalog event occurring to this view rebuild (§11).
    const occurredOn = event.occurredOn instanceof Date ? event.occurredOn.getTime() : new Date(event.occurredOn).getTime();
    if (!Number.isNaN(occurredOn)) {
      this.telemetry.recordProjectionLag(Math.max(0, Date.now() - occurredOn), {
        eventName: event.eventName,
        restaurantId,
      });
    }

    const restaurant = await this.restaurantRepo.findById(restaurantId);
    if (!restaurant) {
      await this.projectionRepo.removeRestaurantView(restaurantId);
      return;
    }
    const items = await this.loadAllItems(restaurantId);
    await this.projectionRepo.upsertRestaurantView(toCommerceCatalogRestaurantView(restaurant, items));
  }

  private async loadAllItems(restaurantId: string): Promise<MenuItem[]> {
    const items: MenuItem[] = [];
    let cursor: string | undefined;
    for (;;) {
      const page = await this.menuItemRepo.findByRestaurant(restaurantId, {
        cursor,
        limit: ITEM_PAGE_LIMIT,
      });
      items.push(...page.items);
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    return items;
  }
}
