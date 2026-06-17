// FulfillmentNotificationDispatcher (Fulfillment Phase 8, §5.2 / §5.3).
//
// Subscribes to the customer/rider-facing fulfillment status events on the in-process bus and turns
// each one into push notification job(s) on `INotificationQueue` (reusing the existing
// NotifyQueue/NotifyWorker spine). Mirrors Identity's `OnUserRegistered` (event → typed queue job +
// in-memory dedup), and the Phase 6 projector / Phase 7 tracking-bridge wiring style.
//
// Exactly-once-per-recipient is enforced two ways:
//   - `jobId = `${eventId}-${recipientRole}`` so BullMQ dedups at the queue level and one event can
//     fan out to customer + rider without a jobId collision (at-least-once outbox delivery collapses
//     to effectively-once enqueueing). NOTE: §5.3 writes this as `${eventId}:${role}`, but BullMQ
//     forbids ':' in a custom job id (it delimits Redis keys), so the suffix is joined with '-' —
//     same intent, legal id.
//   - an in-memory `processedEventIds` guard short-circuits replays within a process lifetime.
//
// Clean Architecture: depends only on the application `INotificationQueue` port and the pure mapper —
// no BullMQ import. The concrete `NotifyQueue` is wired in the container only.
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
      // Out-of-scope or no resolvable recipient — record as processed so a replay stays a no-op.
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
