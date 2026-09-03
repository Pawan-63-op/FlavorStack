import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';

export interface IRestaurantDirectory {
  /** The userId that owns `restaurantId`, or null when the restaurant is unknown. */
  getOwnerId(restaurantId: string): Promise<string | null>;

  /**
   * Where the restaurant is, for ranking riders by proximity to the pickup point. Null when the
   * restaurant is unknown — callers fall back to the unranked available list.
   */
  getLocation(restaurantId: string): Promise<GeoPoint | null>;

  /** All restaurantIds owned by `ownerId` (paged through internally). Empty when none. */
  listRestaurantIdsByOwner(ownerId: string): Promise<string[]>;

  /** Map of restaurantId → name for the supplied ids; missing/unknown ids are omitted. */
  getRestaurantNames(restaurantIds: string[]): Promise<Record<string, string>>;

  /** Total count of non-deleted restaurants (platform-wide), for admin analytics. */
  countAll(): Promise<number>;
}
