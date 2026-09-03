/**
 * Central TanStack Query key factory, namespaced per domain. Using one factory
 * keeps cache keys consistent and invalidation predictable across phases.
 *
 * Convention: keys are tuples `[domain, ...specifiers]`; pagination cursors and
 * filters go in a trailing object so they're structurally compared by TanStack.
 */
export const queryKeys = {
  auth: {
    me: () => ["auth", "me"] as const,
  },
  catalog: {
    restaurants: (cursor?: string) =>
      ["catalog", "restaurants", { cursor }] as const,
    restaurant: (id: string) => ["catalog", "restaurant", id] as const,
    menu: (restaurantId: string) => ["catalog", "menu", restaurantId] as const,
    item: (itemId: string) => ["catalog", "item", itemId] as const,
    search: (query: string, cursor?: string) =>
      ["catalog", "search", { query, cursor }] as const,
    searchItems: (query: string, cursor?: string) =>
      ["catalog", "searchItems", { query, cursor }] as const,
    nearby: (lat: number, lng: number, radiusMeters?: number, deliverableOnly?: boolean) =>
      ["catalog", "nearby", { lat, lng, radiusMeters, deliverableOnly }] as const,
    // `subtotalAmount`/`currency` are part of the key: the fee they resolve to changes
    // across a free-delivery threshold, so two subtotals must not share a cache entry.
    serviceability: (
      lat: number,
      lng: number,
      subtotalAmount?: number,
      currency?: string,
    ) => ["catalog", "serviceability", { lat, lng, subtotalAmount, currency }] as const,
    deliverable: (lat: number, lng: number) =>
      ["catalog", "deliverable", { lat, lng }] as const,
    rating: (restaurantId: string) => ["catalog", "rating", restaurantId] as const,
  },
  cart: {
    current: () => ["cart"] as const,
    summary: () => ["cart", "summary"] as const,
  },
  checkout: {
    preview: (addressId: string) => ["checkout", "preview", addressId] as const,
  },
  orderRequests: {
    detail: (id: string) => ["orderRequests", id] as const,
  },
  orders: {
    myList: () => ["orders", "myList"] as const,
  },
  tracking: {
    detail: (fulfillmentId: string) => ["tracking", fulfillmentId] as const,
  },
  reviews: {
    list: (restaurantId: string, params: { limit?: number; offset?: number } = {}) =>
      ["reviews", "list", restaurantId, params] as const,
    myList: (params: { limit?: number; offset?: number } = {}) =>
      ["reviews", "myList", params] as const,
    rating: (restaurantId: string) => ["reviews", "rating", restaurantId] as const,
  },
  notifications: {
    list: (params: { limit?: number } = {}) => ["notifications", "list", params] as const,
    unreadCount: () => ["notifications", "unreadCount"] as const,
    preferences: () => ["notifications", "preferences"] as const,
  },
  ownerCatalog: {
    restaurants: () => ["ownerCatalog", "restaurants"] as const,
    restaurant: (id: string) => ["ownerCatalog", "restaurant", id] as const,
    menu: (restaurantId: string) => ["ownerCatalog", "menu", restaurantId] as const,
  },
  reviewModeration: {
    list: (params: { status?: string; limit?: number; offset?: number } = {}) =>
      ["reviewModeration", "list", params] as const,
  },
  fulfillmentAdmin: {
    list: (
      params: {
        status?: string;
        slaBreached?: boolean;
        restaurantId?: string;
        limit?: number;
        offset?: number;
      } = {},
    ) => ["fulfillmentAdmin", "list", params] as const,
    restaurantQueue: (restaurantId: string, status?: string) =>
      ["fulfillmentAdmin", "restaurantQueue", restaurantId, status] as const,
  },
  driver: {
    queue: () => ["driver", "queue"] as const,
    deliveries: () => ["driver", "deliveries"] as const,
  },
  analytics: {
    owner: (days?: number) => ["analytics", "owner", { days }] as const,
    platform: (days?: number) => ["analytics", "platform", { days }] as const,
  },
} as const;
