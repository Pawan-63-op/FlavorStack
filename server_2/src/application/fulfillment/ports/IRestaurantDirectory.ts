export interface IRestaurantDirectory {
  /** The userId that owns `restaurantId`, or null when the restaurant is unknown. */
  getOwnerId(restaurantId: string): Promise<string | null>;

  /** All restaurantIds owned by `ownerId` (paged through internally). Empty when none. */
  listRestaurantIdsByOwner(ownerId: string): Promise<string[]>;

  /** Map of restaurantId → name for the supplied ids; missing/unknown ids are omitted. */
  getRestaurantNames(restaurantIds: string[]): Promise<Record<string, string>>;

  /** Total count of non-deleted restaurants (platform-wide), for admin analytics. */
  countAll(): Promise<number>;
}
