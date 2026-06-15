import {
  CommerceCatalogMenuItemView,
  CommerceCatalogRestaurantView,
} from '../types/CommerceCatalogView';

/**
 * Read/write access to the `commerce_catalog_view` local projection (Commerce
 * Phase 5). Fed by `CommerceCatalogProjector` consuming catalog events on
 * `QUEUE.commerce`; used for cart-time validation only (checkout uses
 * `ICatalogGateway` instead).
 */
export interface ICommerceCatalogReadRepository {
  /** The full projected view for a restaurant, or `null` if not (yet) projected / tombstoned. */
  findRestaurantView(restaurantId: string): Promise<CommerceCatalogRestaurantView | null>;

  /** Looks up projected menu items by id across all restaurants. */
  findMenuItemViews(menuItemIds: string[]): Promise<CommerceCatalogMenuItemView[]>;

  /** Wholesale upsert of a restaurant's projection (rebuild-from-source). */
  upsertRestaurantView(view: CommerceCatalogRestaurantView): Promise<void>;

  /** Tombstones (removes) a restaurant's projection, e.g. on soft-delete. */
  removeRestaurantView(restaurantId: string): Promise<void>;

  /**
   * Records that `eventId` has been applied to `restaurantId`'s projection.
   * Returns `true` if this is the first time `eventId` is seen (caller should
   * proceed), or `false` if it was already recorded (idempotent no-op — the
   * event is a redelivery and must not be reapplied).
   */
  markEventProcessed(eventId: string, eventName: string, restaurantId: string): Promise<boolean>;
}
