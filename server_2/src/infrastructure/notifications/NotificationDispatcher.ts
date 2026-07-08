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

    if (notification.status.value === NOTIFICATION_STATUS.SENT) {
      return { outcome: 'SKIPPED', reason: 'already_sent' };
    }

    const adapter = this.channels.get(channel);
    if (!adapter) {
      notification.markFailed(`no_channel:${channel}`);
      await this.notificationRepo.update(notification);
      return { outcome: 'FAILED', reason: `no_channel:${channel}` };
    }

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
