// Batch 4B — NotificationDispatcher (engagement_module.md §8). Drives the send lifecycle for an
// enqueued engagement job: load the persisted PENDING Notification, select the channel by
// `notification.channel`, send, and record the outcome via markSent/markFailed.
//
// Failure model (NotificationStatus: PENDING → SENT | FAILED, FAILED terminal):
//   - channel Result.fail (e.g. no_recipient) → TERMINAL failure: markFailed + persist, no throw
//     (retrying cannot fix a missing address).
//   - channel THROWS (transient provider error) → propagate so the worker's BullMQ retry re-runs the
//     still-PENDING row. We deliberately do NOT markFailed here, because FAILED is terminal and would
//     block the retry's PENDING → SENT transition.
//   - markExhausted(): the worker calls this once retries are exhausted, flipping PENDING → FAILED.
//
// Idempotency: an already-SENT row (at-least-once redelivery) is skipped without re-sending — the
// second line of defence behind the enqueue-time dedupe jobId.
import { INotificationRepository } from '../../domain/engagement/repositories/INotificationRepository';
import { NotificationChannelValue } from '../../domain/engagement/enums/notification-channel.enum';
import { NOTIFICATION_STATUS } from '../../domain/engagement/enums/notification-status.enum';
import { INotificationChannel } from './INotificationChannel';

export type DispatchOutcome = 'SENT' | 'FAILED' | 'SKIPPED';

export interface DispatchResult {
  outcome: DispatchOutcome;
  reason?: string;
}

export class NotificationDispatcher {
  private readonly channels: Map<NotificationChannelValue, INotificationChannel>;

  constructor(
    private readonly notificationRepo: INotificationRepository,
    channels: INotificationChannel[]
  ) {
    this.channels = new Map(channels.map((c) => [c.channel, c]));
  }

  async dispatch(notificationId: string, channel: NotificationChannelValue): Promise<DispatchResult> {
    const notification = await this.notificationRepo.findById(notificationId);
    if (!notification) return { outcome: 'SKIPPED', reason: 'not_found' };

    // Idempotency: at-least-once redelivery of an already-sent notification must not double-send.
    if (notification.status.value === NOTIFICATION_STATUS.SENT) {
      return { outcome: 'SKIPPED', reason: 'already_sent' };
    }

    const adapter = this.channels.get(channel);
    if (!adapter) {
      notification.markFailed(`no_channel:${channel}`);
      await this.notificationRepo.update(notification);
      return { outcome: 'FAILED', reason: `no_channel:${channel}` };
    }

    // Transient provider errors throw out of `send` and propagate to the worker (BullMQ retry).
    const result = await adapter.send(notification);

    if (result.isFailure) {
      const reason = String(result.getError());
      notification.markFailed(reason);
      await this.notificationRepo.update(notification);
      return { outcome: 'FAILED', reason };
    }

    notification.markSent(result.getValue().provider);
    await this.notificationRepo.update(notification);
    return { outcome: 'SENT' };
  }

  /** Called by the worker after BullMQ retries are exhausted — settles a still-PENDING row as FAILED. */
  async markExhausted(notificationId: string, reason: string): Promise<void> {
    const notification = await this.notificationRepo.findById(notificationId);
    if (!notification) return;
    if (notification.status.value !== NOTIFICATION_STATUS.PENDING) return;

    notification.markFailed(reason);
    await this.notificationRepo.update(notification);
  }
}
