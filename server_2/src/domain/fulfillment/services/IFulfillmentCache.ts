// Ports for the fulfillment read-side cache (fulfillment_module.md §12 Phase 9 / Batch 9.1).
//
// Mirrors catalog's ICatalogCache split: a read-through surface for the hot query use cases and an
// invalidation surface for the projector. Two key families back these ports (see FulfillmentCache):
//   • Per-fulfillment tracking keys are dropped directly by id when that fulfillment's projection
//     changes.
//   • The admin dashboard is a filtered list whose membership depends on many fulfillments, so its
//     keys can't be enumerated; invalidation bumps a generation counter, orphaning every old key at
//     once (old keys carry short TTLs and expire on their own).

/** Read-through cache surface used by GetLiveTracking / GetAdminDashboard. */
export interface IFulfillmentReadCache {
  /** Cache-aside the CustomerTrackingView for one fulfillment. */
  rememberTracking<T>(fulfillmentId: string, loader: () => Promise<T>): Promise<T>;
  /** Cache-aside an admin dashboard page, keyed by a deterministic filter discriminator. */
  rememberDashboard<T>(discriminator: string, loader: () => Promise<T>): Promise<T>;
}

/** Invalidation surface called by the projector after a view-mutating event is applied. */
export interface IFulfillmentCacheInvalidator {
  /** Drop the fulfillment's tracking key and rotate the dashboard generation in one shot. */
  invalidateFulfillment(fulfillmentId: string): Promise<void>;
}
