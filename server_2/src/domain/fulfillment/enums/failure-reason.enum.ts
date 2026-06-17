// Reason a delivery could not be completed (fulfillment_module.md §2.4). Realized in Phase 5.
export const FAILURE_REASON = {
  CUSTOMER_UNAVAILABLE: 'CUSTOMER_UNAVAILABLE',
  ADDRESS_NOT_FOUND: 'ADDRESS_NOT_FOUND',
  RIDER_CANCELLED: 'RIDER_CANCELLED',
  RESTAURANT_CLOSED: 'RESTAURANT_CLOSED',
  DELIVERY_TIMEOUT: 'DELIVERY_TIMEOUT',
  OTHER: 'OTHER',
} as const;

export type FailureReasonValue = (typeof FAILURE_REASON)[keyof typeof FAILURE_REASON];
