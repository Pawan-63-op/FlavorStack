import { Notification } from '../../../domain/engagement/entities/Notification';

export interface NotificationResponse {
  notificationId: string;
  recipientUserId: string;
  category: string;
  channel: string;
  templateKey: string;
  title: string;
  body: string;
  status: string;
  provider: string | null;
  createdAt: string;
  sentAt?: string;
  failedReason?: string;
  readAt?: string;
}

export function toNotificationResponse(notification: Notification): NotificationResponse {
  return {
    notificationId: notification.id.toString(),
    recipientUserId: notification.recipientUserId,
    category: notification.category,
    channel: notification.channel,
    templateKey: notification.templateKey,
    title: notification.renderedTitle,
    body: notification.renderedBody,
    status: notification.status.value,
    provider: notification.provider ?? null,
    createdAt: notification.createdAt.toISOString(),
    sentAt: notification.sentAt?.toISOString(),
    failedReason: notification.failedReason,
    readAt: notification.readAt?.toISOString(),
  };
}
