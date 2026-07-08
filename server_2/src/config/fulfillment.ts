export interface FulfillmentConfig {
  offerTtlSeconds: number;
  maxAssignmentAttempts: number;
  readyForPickupSlaSeconds: number;
  outForDeliverySlaSeconds: number;
  trackingCacheTtlSeconds: number;
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
