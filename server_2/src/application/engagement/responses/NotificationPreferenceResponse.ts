import { NotificationPreference } from '../../../domain/engagement/entities/NotificationPreference';
import { NOTIFICATION_CATEGORY, NotificationCategoryValue } from '../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../domain/engagement/enums/notification-channel.enum';

export interface ChannelToggleResponse {
  push: boolean;
  email: boolean;
}

export interface NotificationPreferenceResponse {
  userId: string;
  channels: Record<NotificationCategoryValue, ChannelToggleResponse>;
  updatedAt: string;
}

export function toNotificationPreferenceResponse(
  preference: NotificationPreference
): NotificationPreferenceResponse {
  const channels = {} as Record<NotificationCategoryValue, ChannelToggleResponse>;
  for (const category of Object.values(NOTIFICATION_CATEGORY)) {
    channels[category] = {
      push: preference.isEnabled(category, NOTIFICATION_CHANNEL.PUSH),
      email: preference.isEnabled(category, NOTIFICATION_CHANNEL.EMAIL),
    };
  }
  return {
    userId: preference.userId,
    channels,
    updatedAt: preference.updatedAt.toISOString(),
  };
}
