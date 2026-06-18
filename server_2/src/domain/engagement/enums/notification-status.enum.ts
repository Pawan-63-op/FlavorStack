// Notification dispatch lifecycle states (engagement_module.md §2): PENDING → SENT | FAILED; SENT → READ.
export const NOTIFICATION_STATUS = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  READ: 'READ',
} as const;

export type NotificationStatusValue = (typeof NOTIFICATION_STATUS)[keyof typeof NOTIFICATION_STATUS];
