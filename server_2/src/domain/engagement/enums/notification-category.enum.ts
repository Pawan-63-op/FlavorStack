// Notification categories a user can independently toggle per channel (engagement_module.md §2).
export const NOTIFICATION_CATEGORY = {
  ORDER_UPDATES: 'ORDER_UPDATES',
  DELIVERY: 'DELIVERY',
  SECURITY: 'SECURITY',
  PROMOTIONS: 'PROMOTIONS',
} as const;

export type NotificationCategoryValue = (typeof NOTIFICATION_CATEGORY)[keyof typeof NOTIFICATION_CATEGORY];
