export const NOTIFICATION_STATUS = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  READ: 'READ',
} as const;

export type NotificationStatusValue = (typeof NOTIFICATION_STATUS)[keyof typeof NOTIFICATION_STATUS];
