import { CatalogQueryMenuItem, CatalogQueryRestaurant } from '../types/QueryModels';

/**
 * Read-only queries against the catalog source of truth (`restaurants` + `menu_items`).
 *
 * This exists so reads that need *fresh, complete* catalog data — cart validation,
 * checkout variant resolution, the restaurant menu, serviceability — can hit the write
 * collections directly instead of a derived projection, without hydrating aggregates
 * through the write-side repositories. No method here writes, and none participates in
 * a transaction.
 *
 * "Public" methods apply the published-restaurant filter
 * (`visibility: PUBLIC`, `status: ACTIVE`, `deletedAt: null`); the unfiltered
 * `findRestaurantById` returns unpublished restaurants too, because cart validation
 * must be able to tell a customer *why* a restaurant is unavailable rather than simply
 * finding nothing.
 */
export interface ICatalogQueryRepository {
  /** Any non-deleted restaurant, published or not. `null` if absent or soft-deleted. */
  findRestaurantById(restaurantId: string): Promise<CatalogQueryRestaurant | null>;

  /** A published restaurant (PUBLIC + ACTIVE + not deleted), or `null`. */
  findPublicRestaurantById(restaurantId: string): Promise<CatalogQueryRestaurant | null>;

  /** Published restaurants for the given ids, in unspecified order; absent ids are omitted. */
  findPublicRestaurantsByIds(restaurantIds: string[]): Promise<CatalogQueryRestaurant[]>;

  /** Non-deleted items for the given ids, in unspecified order; absent ids are omitted. */
  findMenuItemsByIds(menuItemIds: string[]): Promise<CatalogQueryMenuItem[]>;

  /** Every non-deleted item of a restaurant, ordered by `_id` ascending. */
  findMenuItemsByRestaurant(restaurantId: string): Promise<CatalogQueryMenuItem[]>;
}
