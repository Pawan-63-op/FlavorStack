import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { StartedRedisContainer } from '@testcontainers/redis';

import { EmailQueue } from '../../../../infrastructure/workers/email/EmailQueue';
import { EmailWorker } from '../../../../infrastructure/workers/email/EmailWorker';
import { JobLogger } from '../../../../infrastructure/workers/shared/JobLogger';
import { getBullConnection, getDefaultJobOptions, QUEUE } from '../../../../config/bullmq';
import { IEmailProvider } from '../../../../domain/identity/services/IEmailProvider';
import { EmailJob } from '../../../../application/shared/queues/jobs';
import { startRedisContainer, StartedTestRedis } from '../redis-container';
import { waitUntil } from './helpers';

function createEmailProvider(): jest.Mocked<IEmailProvider> {
  return {
    sendVerification: jest.fn().mockResolvedValue(undefined),
    sendNotification: jest.fn().mockResolvedValue(undefined),
  };
}

const WELCOME_JOB: EmailJob = {
  type: 'notification',
  to: 'user@example.com',
  subject: 'Welcome to FlavorStack',
  body: 'Hi Ada, thanks for joining FlavorStack.',
};

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
    const worker = new EmailWorker(provider, new JobLogger(QUEUE.email));

    try {
      await emailQueue.enqueue(WELCOME_JOB, { jobId: 'evt-consume-1' });

      await waitUntil(() => provider.sendNotification.mock.calls.length === 1);

      expect(provider.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'user@example.com' }),
        'Welcome to FlavorStack',
        expect.stringContaining('Ada'),
      );
    } finally {
      await Promise.all([worker.close(), emailQueue.close()]);
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
    const worker = new EmailWorker(provider, new JobLogger(QUEUE.email));

    try {
      await emailQueue.enqueue(WELCOME_JOB, { jobId: 'evt-retry-1' });

      await waitUntil(() => attempt === 3, 30000);

      expect(attemptsAtFailure).toEqual([1, 2]);
      expect(provider.sendNotification).toHaveBeenCalledTimes(3);
    } finally {
      await Promise.all([worker.close(), emailQueue.close()]);
    }
  }, 40000);

  // Phase 8 replaced the dead-letter queue with BullMQ's own retention: `removeOnFail: false`
  // (see `getDefaultJobOptions`) keeps the exhausted job in `bull:email-queue:failed` with its
  // payload, failedReason and attemptsMade — everything `DeadLetterPayload` used to copy onto a
  // queue that had no consumer.
  it('retention: a job that always fails is retained in the queue\'s failed set after exhausting retries', async () => {
    const provider = createEmailProvider();
    provider.sendNotification.mockRejectedValue(new Error('permanent failure'));

    const emailQueue = new EmailQueue();
    const rawQueue = new Queue<EmailJob>(QUEUE.email, {
      connection: getBullConnection(),
      defaultJobOptions: getDefaultJobOptions(),
    });
    const worker = new EmailWorker(provider, new JobLogger(QUEUE.email));

    try {
      await emailQueue.enqueue(WELCOME_JOB, { jobId: 'evt-failed-1' });

      await waitUntil(async () => (await rawQueue.getFailed()).length === 1, 40000);

      const [failedJob] = await rawQueue.getFailed();
      expect(failedJob.id).toBe('evt-failed-1');
      expect(failedJob.name).toBe('notification');
      expect(failedJob.data).toMatchObject({ to: 'user@example.com', subject: 'Welcome to FlavorStack' });
      expect(failedJob.failedReason).toBe('permanent failure');
      expect(failedJob.attemptsMade).toBe(3);
      expect(await failedJob.getState()).toBe('failed');
      expect(provider.sendNotification).toHaveBeenCalledTimes(3);
    } finally {
      await Promise.all([worker.close(), emailQueue.close(), rawQueue.close()]);
    }
  }, 45000);

  it('dedup: enqueueing the same jobId twice results in the job being consumed only once', async () => {
    const provider = createEmailProvider();
    const emailQueue = new EmailQueue();

    await emailQueue.enqueue(WELCOME_JOB, { jobId: 'evt-dedup-1' });
    await emailQueue.enqueue(WELCOME_JOB, { jobId: 'evt-dedup-1' });

    const worker = new EmailWorker(provider, new JobLogger(QUEUE.email));

    try {
      await waitUntil(() => provider.sendNotification.mock.calls.length >= 1, 30000);
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(provider.sendNotification).toHaveBeenCalledTimes(1);
    } finally {
      await Promise.all([worker.close(), emailQueue.close()]);
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
    const rawQueue = new Queue<EmailJob>(QUEUE.email, { connection: getBullConnection() });
    const worker = new EmailWorker(provider, new JobLogger(QUEUE.email));

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
      await Promise.all([emailQueue.close(), rawQueue.close()]);
    }
  }, 30000);
});
