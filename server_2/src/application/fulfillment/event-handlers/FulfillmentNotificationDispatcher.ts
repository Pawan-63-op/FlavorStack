import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { INotificationQueue } from '../../shared/queues/INotificationQueue';
import { NotificationJob } from '../../shared/queues/jobs';
import { mapFulfillmentEventToNotification } from './FulfillmentNotificationMapper';

export class FulfillmentNotificationDispatcher {
  private readonly processedEventIds = new Set<string>();

  constructor(private readonly notificationQueue: INotificationQueue) {}

  async handle(event: DomainEvent): Promise<void> {
    if (this.processedEventIds.has(event.eventId)) return;

    const notification = mapFulfillmentEventToNotification(event);
    if (!notification) {
      this.processedEventIds.add(event.eventId);
      return;
    }

    for (const recipient of notification.recipients) {
      const job: NotificationJob = {
        type: 'push',
        token: recipient.id,
        title: notification.title,
        body: notification.body,
        data: notification.data,
      };
      await this.notificationQueue.enqueue(job, { jobId: `${event.eventId}-${recipient.role}` });
    }

    this.processedEventIds.add(event.eventId);
  }
}
