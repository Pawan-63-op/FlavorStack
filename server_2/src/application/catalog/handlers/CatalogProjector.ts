import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { IRestaurantRepository } from '../../../domain/catalog/repositories/IRestaurantRepository';
import { IMenuItemRepository } from '../../../domain/catalog/repositories/IMenuItemRepository';
import { ICatalogProjectionWriter } from '../../../domain/catalog/repositories/ICatalogProjectionWriter';
import { MenuItem } from '../../../domain/catalog/entities/MenuItem';

const ITEM_PAGE_LIMIT = 100;

export class CatalogProjector {
  constructor(
    private readonly restaurantRepo: IRestaurantRepository,
    private readonly menuItemRepo: IMenuItemRepository,
    private readonly projectionWriter: ICatalogProjectionWriter
  ) {}


  /** RestaurantCreated/Updated/StatusChanged, CategoryAdded/Updated, DeliveryZoneChanged. */
  async onRestaurantEvent(event: DomainEvent): Promise<void> {
    await this.rebuild(event.aggregateId);
  }

  /** MenuItemCreated / MenuItemAvailabilityChanged — carry `restaurantId`. */
  async onMenuItemEvent(event: DomainEvent & { restaurantId: string }): Promise<void> {
    await this.rebuild(event.restaurantId);
  }

  /** MenuItemUpdated — only the item id is known; resolve its restaurant. */
  async onMenuItemUpdated(event: DomainEvent): Promise<void> {
    const item = await this.menuItemRepo.findById(event.aggregateId);
    if (!item) return; // deleted/unknown — a later restaurant event will reconcile
    await this.rebuild(item.restaurantId);
  }


  /**
   * Rebuild every projection for a restaurant from source aggregates, or tombstone
   * them if the restaurant no longer exists (soft-deleted).
   */
  async rebuild(restaurantId: string): Promise<void> {
    const restaurant = await this.restaurantRepo.findById(restaurantId);
    if (!restaurant) {
      await this.projectionWriter.removeRestaurant(restaurantId);
      return;
    }
    const items = await this.loadAllItems(restaurantId);
    await this.projectionWriter.rebuildRestaurant(restaurant, items);
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
