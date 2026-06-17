// Fulfillment assignment tunables (fulfillment_module.md §15.6 — one source for TTL/attempt/SLA
// limits, read by the offer use cases and the timeout/SLA/auto-cancel jobs of Phase 5B / §10).
export interface FulfillmentConfig {
  // How long a rider offer stays OFFERED before the assignment-timeout job expires it.
  offerTtlSeconds: number;
  // Max rider attempts before the assignment-timeout job auto-cancels the fulfillment.
  maxAssignmentAttempts: number;
  // SLA deadline from READY_FOR_PICKUP — if still not picked up, the pre-pickup fulfillment is auto-cancelled.
  readyForPickupSlaSeconds: number;
  // SLA deadline from OUT_FOR_DELIVERY — if still in transit, the fulfillment is flagged for admin (no auto-cancel post-pickup).
  outForDeliverySlaSeconds: number;
  // Phase 9 (Batch 9.1) read-side cache TTLs (cache-aside via CacheStore).
  // Per-fulfillment customer tracking view.
  trackingCacheTtlSeconds: number;
  // Admin dashboard pages (generation-rotated on any view-mutating event).
  dashboardCacheTtlSeconds: number;
}

export function getFulfillmentConfig(): FulfillmentConfig {
  return {
    offerTtlSeconds: Number(process.env.FULFILLMENT_OFFER_TTL_SECONDS ?? 60),
    maxAssignmentAttempts: Number(process.env.FULFILLMENT_MAX_ASSIGNMENT_ATTEMPTS ?? 3),
    readyForPickupSlaSeconds: Number(process.env.FULFILLMENT_READY_SLA_SECONDS ?? 900),
    outForDeliverySlaSeconds: Number(process.env.FULFILLMENT_DELIVERY_SLA_SECONDS ?? 2700),
    trackingCacheTtlSeconds: Number(process.env.FULFILLMENT_TRACKING_CACHE_TTL_SECONDS ?? 30),
    dashboardCacheTtlSeconds: Number(process.env.FULFILLMENT_DASHBOARD_CACHE_TTL_SECONDS ?? 15),
  };
}
