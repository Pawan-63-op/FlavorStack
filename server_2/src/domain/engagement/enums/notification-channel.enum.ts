export const NOTIFICATION_CHANNEL = {
  INBOX: 'INBOX',
  EMAIL: 'EMAIL',
} as const;

export type NotificationChannelValue = (typeof NOTIFICATION_CHANNEL)[keyof typeof NOTIFICATION_CHANNEL];
