// Catalog caching ports (Phase 13). Framework-free contracts so the application
// layer can depend on cache behaviour without importing Redis. The Redis-backed
// implementation lives in infrastructure and is wired only in the container.

/**
 * Event-driven invalidation port. The read-model projector calls this AFTER it has
 * rebuilt (or tombstoned) a restaurant's projections, so the next read repopulates
 * the cache from the now-fresh projection — no stale reads survive a write.
 *
 * Invalidating a restaurant must also rotate any collection-scoped caches whose
 * membership/content depends on that restaurant (browse lists, serviceability),
 * since those keys cannot be enumerated by restaurant id.
 */
export interface ICatalogCacheInvalidator {
  invalidateRestaurant(restaurantId: string): Promise<void>;
}

/** A geographic point used as part of a serviceability cache key. */
export interface ServiceabilityCachePoint {
  lat: number;
  lng: number;
}

/** The order subtotal that influences the resolved delivery fee. */
export interface ServiceabilityCacheSubtotal {
  amount: number;
  currency: string;
}

/**
 * Read-through cache for `CheckServiceability` results. Keyed by point + subtotal
 * and scoped to the current catalog cache generation, so any restaurant/zone change
 * (which bumps the generation) transparently produces a fresh computation.
 */
export interface IServiceabilityCache {
  remember<T>(
    point: ServiceabilityCachePoint,
    subtotal: ServiceabilityCacheSubtotal,
    loader: () => Promise<T>
  ): Promise<T>;
}
