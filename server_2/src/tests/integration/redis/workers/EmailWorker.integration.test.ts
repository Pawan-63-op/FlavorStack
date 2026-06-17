import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { StartedRedisContainer } from '@testcontainers/redis';

import { EmailQueue } from '../../../../infrastructure/workers/email/EmailQueue';
import { EmailWorker } from '../../../../infrastructure/workers/email/EmailWorker';
import { DLQHandler } from '../../../../infrastructure/workers/shared/DLQHandler';
import { JobLogger } from '../../../../infrastructure/workers/shared/JobLogger';
import { getBullConnection, getDefaultJobOptions, QUEUE } from '../../../../config/bullmq';
import { IEmailProvider } from '../../../../domain/identity/services/IEmailProvider';
import { EmailJob } from '../../../../application/shared/queues/jobs';
import { startRedisContainer, StartedTestRedis } from '../redis-container';
import { waitUntil } from './helpers';

function createEmailProvider(): jest.Mocked<IEmailProvider> {
  return {
    sendVerification: jest.fn().mockResolvedValue(undefined),
    sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    sendNotification: jest.fn().mockResolvedValue(undefined),
  };
}

function buildDlqQueue(): Queue {
  return new Queue(QUEUE.dlq, { connection: getBullConnection(), defaultJobOptions: getDefaultJobOptions() });
}

const WELCOME_JOB: EmailJob = { type: 'welcome', to: 'user@example.com', name: 'Ada' };

describe('EmailWorker integration (BullMQ + Redis)', () => {
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

  it('enqueue -> consume: a job added to email-queue is processed exactly once', async () => {
    const provider = createEmailProvider();
    const emailQueue = new EmailQueue();
    const dlqQueue = buildDlqQueue();
    const worker = new EmailWorker(provider, new DLQHandler(dlqQueue), new JobLogger(QUEUE.email));

    try {
      await emailQueue.enqueue(WELCOME_JOB, { jobId: 'evt-consume-1' });

      await waitUntil(() => provider.sendNotification.mock.calls.length === 1);

      expect(provider.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'user@example.com' }),
        'Welcome to FlavorStack',
        expect.stringContaining('Ada'),
      );
    } finally {
      await Promise.all([worker.close(), emailQueue.close(), dlqQueue.close()]);
    }
  }, 30000);

  it('retry: a job that fails twice is retried with exponential backoff and eventually succeeds', async () => {
    const provider = createEmailProvider();
    let attempt = 0;
    const attemptsAtFailure: number[] = [];

    provider.sendNotification.mockImplementation(async () => {
      attempt += 1;
      if (attempt < 3) {
        attemptsAtFailure.push(attempt);
        throw new Error('transient email failure');
      }
    });

    const emailQueue = new EmailQueue();
    const dlqQueue = buildDlqQueue();
    const worker = new EmailWorker(provider, new DLQHandler(dlqQueue), new JobLogger(QUEUE.email));

    try {
      await emailQueue.enqueue(WELCOME_JOB, { jobId: 'evt-retry-1' });

      await waitUntil(() => attempt === 3, 30000);

      expect(attemptsAtFailure).toEqual([1, 2]);
      expect(provider.sendNotification).toHaveBeenCalledTimes(3);
    } finally {
      await Promise.all([worker.close(), emailQueue.close(), dlqQueue.close()]);
    }
  }, 40000);

  it('DLQ: a job that always fails is routed to dead-letter-queue after exhausting retries', async () => {
    const provider = createEmailProvider();
    provider.sendNotification.mockRejectedValue(new Error('permanent failure'));

    const emailQueue = new EmailQueue();
    const dlqQueue = buildDlqQueue();
    const worker = new EmailWorker(provider, new DLQHandler(dlqQueue), new JobLogger(QUEUE.email));

    try {
      await emailQueue.enqueue(WELCOME_JOB, { jobId: 'evt-dlq-1' });

      await waitUntil(async () => (await dlqQueue.getWaiting()).length === 1, 40000);

      const [dlqJob] = await dlqQueue.getWaiting();
      expect(dlqJob.data).toMatchObject({
        sourceQueue: QUEUE.email,
        jobName: 'welcome',
        failedReason: 'permanent failure',
        attemptsMade: 3,
      });
      expect(provider.sendNotification).toHaveBeenCalledTimes(3);
    } finally {
      await Promise.all([worker.close(), emailQueue.close(), dlqQueue.close()]);
    }
  }, 45000);

  it('dedup: enqueueing the same jobId twice results in the job being consumed only once', async () => {
    const provider = createEmailProvider();
    const emailQueue = new EmailQueue();
    const dlqQueue = buildDlqQueue();

    await emailQueue.enqueue(WELCOME_JOB, { jobId: 'evt-dedup-1' });
    await emailQueue.enqueue(WELCOME_JOB, { jobId: 'evt-dedup-1' });

    const worker = new EmailWorker(provider, new DLQHandler(dlqQueue), new JobLogger(QUEUE.email));

    try {
      await waitUntil(() => provider.sendNotification.mock.calls.length >= 1, 30000);
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(provider.sendNotification).toHaveBeenCalledTimes(1);
    } finally {
      await Promise.all([worker.close(), emailQueue.close(), dlqQueue.close()]);
    }
  }, 30000);

  it('graceful shutdown: an in-flight job completes on close() and no new job is picked up', async () => {
    const provider = createEmailProvider();
    let firstCalls = 0;
    let releaseFirst: () => void = () => {};

    provider.sendNotification.mockImplementation(() => {
      firstCalls += 1;
      if (firstCalls === 1) {
        return new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
      }
      return Promise.resolve();
    });

    const emailQueue = new EmailQueue();
    const dlqQueue = buildDlqQueue();
    const rawQueue = new Queue<EmailJob>(QUEUE.email, { connection: getBullConnection() });
    const worker = new EmailWorker(provider, new DLQHandler(dlqQueue), new JobLogger(QUEUE.email));

    try {
      await emailQueue.enqueue(WELCOME_JOB, { jobId: 'evt-shutdown-1' });

      await waitUntil(() => firstCalls === 1, 30000);

      await emailQueue.enqueue(WELCOME_JOB, { jobId: 'evt-shutdown-2' });

      const closePromise = worker.close();
      releaseFirst();
      await closePromise;

      expect(provider.sendNotification).toHaveBeenCalledTimes(1);

      const secondJob = await rawQueue.getJob('evt-shutdown-2');
      expect(secondJob).toBeDefined();
      expect(await secondJob!.getState()).toBe('waiting');
    } finally {
      await Promise.all([emailQueue.close(), dlqQueue.close(), rawQueue.close()]);
    }
  }, 30000);
});
