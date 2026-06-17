// Unit tests for FulfillmentNotificationDispatcher (Fulfillment Phase 8, §5.2 / §5.3).
//
// Verifies: one job per recipient with token = recipientId + jobId = `${eventId}-${role}`; fan-out to
// customer + rider on one event without jobId collision; replay/dedup (jobId + in-memory guard);
// internal/out-of-scope events enqueue nothing.
import { FulfillmentNotificationDispatcher } from '../../../../application/fulfillment/event-handlers/FulfillmentNotificationDispatcher';
import { INotificationQueue } from '../../../../application/shared/queues/INotificationQueue';
import { DomainEvent } from '../../../../domain/shared/DomainEvent';

function makeQueue(): jest.Mocked<INotificationQueue> {
  return { enqueue: jest.fn().mockResolvedValue(undefined), close: jest.fn() } as jest.Mocked<INotificationQueue>;
}

function event(partial: Record<string, unknown>): DomainEvent {
  return {
    eventId: 'evt-1',
    occurredOn: new Date('2026-06-16T10:00:00.000Z'),
    aggregateId: 'ful-1',
    ...partial,
  } as unknown as DomainEvent;
}

describe('FulfillmentNotificationDispatcher', () => {
  it('enqueues one push per recipient, keyed by `${eventId}-${role}` with token = recipientId', async () => {
    const queue = makeQueue();
    const dispatcher = new FulfillmentNotificationDispatcher(queue);

    await dispatcher.handle(event({ eventName: 'FulfillmentCreated', customerId: 'cust-1' }));

    expect(queue.enqueue).toHaveBeenCalledTimes(1);
    expect(queue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'push', token: 'cust-1', title: 'Order confirmed' }),
      { jobId: 'evt-1-customer' },
    );
  });

  it('fans a single event out to customer + rider with distinct jobIds', async () => {
    const queue = makeQueue();
    const dispatcher = new FulfillmentNotificationDispatcher(queue);

    await dispatcher.handle(
      event({ eventName: 'DeliveryCompleted', customerId: 'cust-1', riderId: 'rider-9' }),
    );

    expect(queue.enqueue).toHaveBeenCalledTimes(2);
    const jobIds = queue.enqueue.mock.calls.map((c) => c[1]?.jobId);
    expect(jobIds).toEqual(['evt-1-customer', 'evt-1-rider']);
    const tokens = queue.enqueue.mock.calls.map((c) => (c[0] as { token: string }).token);
    expect(tokens).toEqual(['cust-1', 'rider-9']);
  });

  it('does not re-enqueue when the same eventId is replayed (in-memory dedup)', async () => {
    const queue = makeQueue();
    const dispatcher = new FulfillmentNotificationDispatcher(queue);
    const e = event({ eventName: 'RiderAssigned', riderId: 'rider-9' });

    await dispatcher.handle(e);
    await dispatcher.handle(e);

    expect(queue.enqueue).toHaveBeenCalledTimes(1);
  });

  it('ignores internal-only events', async () => {
    const queue = makeQueue();
    const dispatcher = new FulfillmentNotificationDispatcher(queue);

    await dispatcher.handle(event({ eventName: 'RiderOffered', riderId: 'rider-9' }));
    await dispatcher.handle(event({ eventId: 'evt-2', eventName: 'RiderAssignmentExpired', riderId: 'r' }));

    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('enqueues nothing for an in-scope event without a resolvable recipient', async () => {
    const queue = makeQueue();
    const dispatcher = new FulfillmentNotificationDispatcher(queue);

    await dispatcher.handle(event({ eventName: 'ReadyForPickup', restaurantId: 'rest-1' }));

    expect(queue.enqueue).not.toHaveBeenCalled();
  });
});
