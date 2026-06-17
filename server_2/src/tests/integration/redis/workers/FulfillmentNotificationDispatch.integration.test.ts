// Fulfillment Phase 8, Batch 3 — end-to-end DoD verification for the notification path across the
// queue/worker seam (BullMQ + Redis). Proves the §12 DoD "notifications fire once per event (dedup
// verified); failures land in DLQ" for the FULFILLMENT side specifically:
//
//   fulfillment status event → FulfillmentNotificationDispatcher → NotifyQueue (notification-queue)
//     → NotifyWorker → IPushProvider.sendPush
//
// Complements the worker-level NotifyWorker.integration.test.ts (raw push jobs) by driving the real
// dispatcher: per-recipient fan-out, replay dedup, and the notification DLQ.
//
// The assignment-retry → auto-cancel-after-N and SLA-timeout paths are NOT re-proven here — they are
// covered by the existing Phase 5B suites (src/tests/integration/fulfillment/failure-reassignment +
// cancellation + assignment-flow); Batch 3's verification step runs those to confirm no regression.
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { StartedRedisContainer } from '@testcontainers/redis';

import { NotifyQueue } from '../../../../infrastructure/workers/notification/NotifyQueue';
import { NotifyWorker } from '../../../../infrastructure/workers/notification/NotifyWorker';
import { DLQHandler } from '../../../../infrastructure/workers/shared/DLQHandler';
import { JobLogger } from '../../../../infrastructure/workers/shared/JobLogger';
import { getBullConnection, getDefaultJobOptions, QUEUE } from '../../../../config/bullmq';
import { IPushProvider } from '../../../../infrastructure/external/push/IPushProvider';
import { FulfillmentNotificationDispatcher } from '../../../../application/fulfillment/event-handlers/FulfillmentNotificationDispatcher';
import { DomainEvent } from '../../../../domain/shared/DomainEvent';
import { startRedisContainer, StartedTestRedis } from '../redis-container';
import { waitUntil } from './helpers';

function createPushProvider(): jest.Mocked<IPushProvider> {
  return { sendPush: jest.fn().mockResolvedValue(undefined) };
}

function buildDlqQueue(): Queue {
  return new Queue(QUEUE.dlq, { connection: getBullConnection(), defaultJobOptions: getDefaultJobOptions() });
}

/** Minimal fulfillment status event — the dispatcher only reads eventId/eventName/aggregateId + recipient ids. */
function statusEvent(partial: Record<string, unknown>): DomainEvent {
  return {
    occurredOn: new Date('2026-06-16T10:00:00.000Z'),
    aggregateId: 'ful-1',
    ...partial,
  } as unknown as DomainEvent;
}

describe('Fulfillment notification dispatch integration (event -> queue -> worker -> push)', () => {
  let started: StartedTestRedis;
  let container: StartedRedisContainer;
  let flushClient: IORedis;

  beforeAll(async () => {
    started = await startRedisContainer();
    container = started.container;

    process.env.REDIS_HOST = started.config.host;
    process.env.REDIS_PORT = String(started.config.port);
    delete process.env.REDIS_PASSWORD;
    delete process.env.REDIS_DB;
    delete process.env.REDIS_TLS;
    delete process.env.REDIS_KEY_PREFIX;

    flushClient = new IORedis({ host: started.config.host, port: started.config.port, maxRetriesPerRequest: null });
  }, 60000);

  afterAll(async () => {
    await flushClient.quit();
    await container.stop();
  });

  // Clean queues between cases so jobIds / DLQ entries never bleed across tests.
  afterEach(async () => {
    await flushClient.flushall();
  });

  it('dispatches a status event to exactly one push, and a replay enqueues nothing new', async () => {
    const provider = createPushProvider();
    const notifyQueue = new NotifyQueue();
    const dispatcher = new FulfillmentNotificationDispatcher(notifyQueue);
    const dlqQueue = buildDlqQueue();
    const worker = new NotifyWorker(provider, new DLQHandler(dlqQueue), new JobLogger(QUEUE.notification));

    const event = statusEvent({ eventId: 'evt-created-1', eventName: 'FulfillmentCreated', customerId: 'cust-1' });

    try {
      await dispatcher.handle(event);
      await waitUntil(() => provider.sendPush.mock.calls.length === 1);

      // token == customerId placeholder; copy + data flow through from the mapper.
      expect(provider.sendPush).toHaveBeenCalledWith(
        'cust-1',
        'Order confirmed',
        expect.any(String),
        { fulfillmentId: 'ful-1', event: 'FulfillmentCreated' },
      );

      // Replay the same eventId — in-memory guard + jobId dedup => no second send.
      await dispatcher.handle(event);
      await new Promise((r) => setTimeout(r, 1500));
      expect(provider.sendPush).toHaveBeenCalledTimes(1);
    } finally {
      await Promise.all([worker.close(), notifyQueue.close(), dlqQueue.close()]);
    }
  }, 40000);

  it('fans one event out to a push per recipient (customer + rider) with distinct jobIds', async () => {
    const provider = createPushProvider();
    const notifyQueue = new NotifyQueue();
    const dispatcher = new FulfillmentNotificationDispatcher(notifyQueue);
    const dlqQueue = buildDlqQueue();
    const worker = new NotifyWorker(provider, new DLQHandler(dlqQueue), new JobLogger(QUEUE.notification));

    const event = statusEvent({
      eventId: 'evt-done-1',
      eventName: 'DeliveryCompleted',
      customerId: 'cust-1',
      riderId: 'rider-9',
    });

    try {
      await dispatcher.handle(event);
      await waitUntil(() => provider.sendPush.mock.calls.length === 2);

      const tokens = provider.sendPush.mock.calls.map((c) => c[0]).sort();
      expect(tokens).toEqual(['cust-1', 'rider-9']);
    } finally {
      await Promise.all([worker.close(), notifyQueue.close(), dlqQueue.close()]);
    }
  }, 40000);

  it('routes a fulfillment notification whose push always fails to the DLQ after exhausting retries', async () => {
    const provider = createPushProvider();
    provider.sendPush.mockRejectedValue(new Error('fcm unreachable'));

    const notifyQueue = new NotifyQueue();
    const dispatcher = new FulfillmentNotificationDispatcher(notifyQueue);
    const dlqQueue = buildDlqQueue();
    const worker = new NotifyWorker(provider, new DLQHandler(dlqQueue), new JobLogger(QUEUE.notification));

    const event = statusEvent({ eventId: 'evt-fail-1', eventName: 'RiderAssigned', riderId: 'rider-9' });

    try {
      await dispatcher.handle(event);
      await waitUntil(async () => (await dlqQueue.getWaiting()).length === 1, 40000);

      const [dlqJob] = await dlqQueue.getWaiting();
      expect(dlqJob.data).toMatchObject({
        sourceQueue: QUEUE.notification,
        jobName: 'push',
        failedReason: 'fcm unreachable',
        attemptsMade: 3,
      });
      expect(provider.sendPush).toHaveBeenCalledTimes(3);
    } finally {
      await Promise.all([worker.close(), notifyQueue.close(), dlqQueue.close()]);
    }
  }, 50000);
});
