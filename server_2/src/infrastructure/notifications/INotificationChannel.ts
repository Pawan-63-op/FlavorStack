import { Result } from '../../domain/shared/Result';
import { Notification } from '../../domain/engagement/entities/Notification';
import { NotificationChannelValue } from '../../domain/engagement/enums/notification-channel.enum';

/** Terminal failure reason raised when no deliverable address exists for the recipient. */
export const NO_RECIPIENT = 'no_recipient';

export interface ChannelSendResult {
  /** Provider that accepted the message (recorded on the notification via markSent). */
  provider: string;
}

export interface INotificationChannel {
  readonly channel: NotificationChannelValue;
  send(notification: Notification): Promise<Result<ChannelSendResult>>;
}
