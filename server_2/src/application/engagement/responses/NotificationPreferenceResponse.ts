import { NotificationPreference } from '../../../domain/engagement/entities/NotificationPreference';
import { NOTIFICATION_CATEGORY, NotificationCategoryValue } from '../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../domain/engagement/enums/notification-channel.enum';

/**
 * Frozen-contract alias (Phase 5 Batch 2). The JSON key stays `push` — `my-app`'s
 * `lib/api/adapters/notificationPreferences.ts` and `components/notifications/PreferenceToggles.tsx`
 * read it — while the value is sourced from the internal `INBOX` channel. Paired with the inbound
 * alias in `api/v1/validators/notification.validator.ts`.
 */
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
      push: preference.isEnabled(category, NOTIFICATION_CHANNEL.INBOX),
      email: preference.isEnabled(category, NOTIFICATION_CHANNEL.EMAIL),
    };
  }
  return {
    userId: preference.userId,
    channels,
    updatedAt: preference.updatedAt.toISOString(),
  };
}
