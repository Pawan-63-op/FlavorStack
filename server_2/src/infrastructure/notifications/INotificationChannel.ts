// Batch 4A — channel port (engagement_module.md §8). One adapter per NotificationChannel; the
// NotificationDispatcher (Batch 4B) selects the channel by `notification.channel` and calls `send`.
//
// Send contract:
//   - success           → Result.ok({ provider }) — dispatcher then markSent(provider).
//   - terminal failure  → Result.fail('no_recipient') when the recipient address is missing/invalid.
//                         Retrying will not fix it, so the dispatcher marks the row FAILED.
//   - transient failure → the underlying provider error is allowed to THROW (not swallowed), so the
//                         worker's BullMQ retry can re-run the still-PENDING notification.
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
