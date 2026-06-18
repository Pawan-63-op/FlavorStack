// Delivery channels for a notification (engagement_module.md §2).
export const NOTIFICATION_CHANNEL = {
  PUSH: 'PUSH',
  EMAIL: 'EMAIL',
} as const;

export type NotificationChannelValue = (typeof NOTIFICATION_CHANNEL)[keyof typeof NOTIFICATION_CHANNEL];
