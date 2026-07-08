import { NotificationCategoryValue } from '../../../domain/engagement/enums/notification-category.enum';
import { NotificationChannelValue } from '../../../domain/engagement/enums/notification-channel.enum';

export interface PreferenceChange {
  category: NotificationCategoryValue;
  channel: NotificationChannelValue;
  enabled: boolean;
}

export interface UpdateNotificationPreferencesDto {
  userId: string;
  changes: PreferenceChange[];
}

export interface GetNotificationPreferencesDto {
  userId: string;
}

export interface MarkNotificationReadDto {
  userId: string;
  notificationId: string;
}

export interface GetNotificationHistoryDto {
  userId: string;
  limit?: number;
  offset?: number;
}

export interface GetUnreadCountDto {
  userId: string;
}

export interface UnreadCountResponse {
  count: number;
}
