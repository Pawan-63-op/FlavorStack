export const CANCELLED_BY = {
  CUSTOMER: 'CUSTOMER',
  RESTAURANT: 'RESTAURANT',
  RIDER: 'RIDER',
  SYSTEM: 'SYSTEM',
} as const;

export type CancelledByValue = (typeof CANCELLED_BY)[keyof typeof CANCELLED_BY];
