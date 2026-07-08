
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
