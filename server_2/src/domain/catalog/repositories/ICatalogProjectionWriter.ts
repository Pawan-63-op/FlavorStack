import { Restaurant } from '../entities/Restaurant';
import { MenuItem } from '../entities/MenuItem';

/**
 * Write port for the catalog read-model projections (Phase 9).
 *
 * The projector rebuilds a restaurant's denormalized projections wholesale from
 * the source aggregates — a robust, idempotent strategy (events are thin, so a
 * full rebuild from the committed aggregates avoids fiddly partial patching).
 * Projections are updated AFTER the write transaction commits, so the writer
 * uses plain (session-less) Mongo operations.
 */
export interface ICatalogProjectionWriter {
  /**
   * Rebuild `restaurant_summary`, `restaurant_menu_view`, and the restaurant's
   * `menu_item_search` documents from the live aggregate + its menu items.
   */
  rebuildRestaurant(restaurant: Restaurant, items: MenuItem[]): Promise<void>;

  /**
   * Tombstone every projection for a restaurant (on restaurant soft-delete);
   * read queries filter `deletedAt: null` so the restaurant disappears.
   */
  removeRestaurant(restaurantId: string): Promise<void>;
}
