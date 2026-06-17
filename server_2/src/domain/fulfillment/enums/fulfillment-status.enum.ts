// Master fulfillment lifecycle states (fulfillment_module.md §2.4 / §4.1).
// Phase 1 only ever constructs CREATED; later phases drive the remaining transitions.
export const FULFILLMENT_STATUS = {
  CREATED: 'CREATED',
  PREPARING: 'PREPARING',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  PICKED_UP: 'PICKED_UP',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
} as const;

export type FulfillmentStatusValue = (typeof FULFILLMENT_STATUS)[keyof typeof FULFILLMENT_STATUS];
