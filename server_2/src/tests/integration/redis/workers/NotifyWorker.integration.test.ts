import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { StartedRedisContainer } from '@testcontainers/redis';

import { NotifyQueue } from '../../../../infrastructure/workers/notification/NotifyQueue';
import { NotifyWorker } from '../../../../infrastructure/workers/notification/NotifyWorker';
import { DLQHandler } from '../../../../infrastructure/workers/shared/DLQHandler';
import { JobLogger } from '../../../../infrastructure/workers/shared/JobLogger';
import { getBullConnection, getDefaultJobOptions, QUEUE } from '../../../../config/bullmq';
import { IPushProvider } from '../../../../infrastructure/external/push/IPushProvider';
import { NotificationJob } from '../../../../application/shared/queues/jobs';
import { startRedisContainer, StartedTestRedis } from '../redis-container';
import { waitUntil } from './helpers';

function createPushProvider(): jest.Mocked<IPushProvider> {
  return { sendPush: jest.fn().mockResolvedValue(undefined) };
}

function buildDlqQueue(): Queue {
  return new Queue(QUEUE.dlq, { connection: getBullConnection(), defaultJobOptions: getDefaultJobOptions() });
}

const PUSH_JOB: NotificationJob = { type: 'push', token: 'device-token-1', title: 'Order update', body: 'Your order is on the way' };

describe('NotifyWorker integration (BullMQ + Redis)', () => {
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

  afterEach(async () => {
    await flushClient.flushall();
  });

  it('enqueue -> consume: a push job added to notification-queue is processed exactly once', async () => {
    const provider = createPushProvider();
    const notifyQueue = new NotifyQueue();
    const dlqQueue = buildDlqQueue();
    const worker = new NotifyWorker(provider, new DLQHandler(dlqQueue), new JobLogger(QUEUE.notification));

    try {
      await notifyQueue.enqueue(PUSH_JOB, { jobId: 'evt-push-consume-1' });

      await waitUntil(() => provider.sendPush.mock.calls.length === 1);

      expect(provider.sendPush).toHaveBeenCalledWith('device-token-1', 'Order update', 'Your order is on the way', undefined);
    } finally {
      await Promise.all([worker.close(), notifyQueue.close(), dlqQueue.close()]);
    }
  }, 30000);

  it('DLQ: a push job that always fails is routed to dead-letter-queue after exhausting retries', async () => {
    const provider = createPushProvider();
    provider.sendPush.mockRejectedValue(new Error('fcm unreachable'));

    const notifyQueue = new NotifyQueue();
    const dlqQueue = buildDlqQueue();
    const worker = new NotifyWorker(provider, new DLQHandler(dlqQueue), new JobLogger(QUEUE.notification));

    try {
      await notifyQueue.enqueue(PUSH_JOB, { jobId: 'evt-push-dlq-1' });

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
  }, 45000);
});
