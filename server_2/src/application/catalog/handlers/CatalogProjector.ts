// CatalogProjector — in-process read-model projector (Catalog Phase 9).
//
// Subscribes to catalog domain events on the InMemoryEventBus (sync, same process,
// run AFTER the write transaction commits). On any restaurant- or item-affecting
// event it rebuilds that restaurant's projections WHOLESALE from the now-committed
// source aggregates. Events are thin (ids only), so reloading the aggregates is
// simpler and more robust than patching projections field-by-field.
//
// If the restaurant aggregate is gone (soft-deleted), its projections are
// tombstoned instead.
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { IRestaurantRepository } from '../../../domain/catalog/repositories/IRestaurantRepository';
import { IMenuItemRepository } from '../../../domain/catalog/repositories/IMenuItemRepository';
import { ICatalogProjectionWriter } from '../../../domain/catalog/repositories/ICatalogProjectionWriter';
import { ICatalogCacheInvalidator } from '../../../domain/catalog/services/ICatalogCache';
import { MenuItem } from '../../../domain/catalog/entities/MenuItem';

const ITEM_PAGE_LIMIT = 100;

export class CatalogProjector {
  constructor(
    private readonly restaurantRepo: IRestaurantRepository,
    private readonly menuItemRepo: IMenuItemRepository,
    private readonly projectionWriter: ICatalogProjectionWriter,
    // Phase 13: optional cache invalidator. When present, every projection rebuild
    // (or tombstone) drops that restaurant's hot caches and rotates collection
    // caches, so reads never serve data that predates the just-committed write.
    private readonly cacheInvalidator?: ICatalogCacheInvalidator
  ) {}

  // ── event reactions ──────────────────────────────────────────

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

  // ── rebuild core ─────────────────────────────────────────────

  /**
   * Rebuild every projection for a restaurant from source aggregates, or tombstone
   * them if the restaurant no longer exists (soft-deleted).
   */
  async rebuild(restaurantId: string): Promise<void> {
    const restaurant = await this.restaurantRepo.findById(restaurantId);
    if (!restaurant) {
      await this.projectionWriter.removeRestaurant(restaurantId);
      await this.invalidateCache(restaurantId);
      return;
    }
    const items = await this.loadAllItems(restaurantId);
    await this.projectionWriter.rebuildRestaurant(restaurant, items);
    // Invalidate AFTER the projection is committed so a concurrent read repopulates
    // from fresh data, never the pre-write state.
    await this.invalidateCache(restaurantId);
  }

  /** No-op when no cache is wired (mock/non-cached setups). */
  private async invalidateCache(restaurantId: string): Promise<void> {
    if (this.cacheInvalidator) {
      await this.cacheInvalidator.invalidateRestaurant(restaurantId);
    }
  }

  private async loadAllItems(restaurantId: string): Promise<MenuItem[]> {
    const items: MenuItem[] = [];
    let cursor: string | undefined;
    // Walk the cursor-paginated repo to collect the full (non-deleted) item set.
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
