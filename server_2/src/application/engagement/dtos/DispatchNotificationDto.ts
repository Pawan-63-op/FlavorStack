// Input + result shapes for the internal DispatchNotification use case (engagement_module.md §4).
import { NotificationCategoryValue } from '../../../domain/engagement/enums/notification-category.enum';
import { NotificationChannelValue } from '../../../domain/engagement/enums/notification-channel.enum';

export interface DispatchNotificationDto {
  recipientUserId: string;
  category: NotificationCategoryValue;
  channel: NotificationChannelValue;
  templateKey: string;
  /** Defaults to 'en' when omitted. */
  locale?: string;
  /** Template substitution variables. */
  vars?: Record<string, string>;
  /** The id of the event that triggered this dispatch — forms the dedupe key. */
  sourceEventId: string;
}

export type DispatchOutcome = 'DISPATCHED' | 'SKIPPED';
export type DispatchSkipReason = 'channel_disabled' | 'template_unavailable' | 'duplicate';

export interface DispatchNotificationResponse {
  outcome: DispatchOutcome;
  dedupeKey: string;
  reason?: DispatchSkipReason;
  notificationId?: string;
}
