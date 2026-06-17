// Actor that cancelled a fulfillment (fulfillment_module.md §2.4). Used by CancellationInfo.
export const CANCELLED_BY = {
  CUSTOMER: 'CUSTOMER',
  RESTAURANT: 'RESTAURANT',
  RIDER: 'RIDER',
  SYSTEM: 'SYSTEM',
} as const;

export type CancelledByValue = (typeof CANCELLED_BY)[keyof typeof CANCELLED_BY];
