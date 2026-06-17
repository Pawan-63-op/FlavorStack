jest.mock('bullmq', () => ({ Queue: jest.fn() }));

import { Queue } from 'bullmq';
import { EmailQueue } from '../../../../../infrastructure/workers/email/EmailQueue';
import { QUEUE, getDefaultJobOptions } from '../../../../../config/bullmq';
import { EmailJob } from '../../../../../application/shared/queues/jobs';

describe('EmailQueue', () => {
  beforeEach(() => {
    (Queue as unknown as jest.Mock).mockImplementation(function (this: { add: jest.Mock; close: jest.Mock }) {
      this.add = jest.fn().mockResolvedValue(undefined);
      this.close = jest.fn().mockResolvedValue(undefined);
    });
  });

  it('constructs a BullMQ Queue for email-queue with default job options', () => {
    new EmailQueue();

    expect(Queue).toHaveBeenCalledWith(
      QUEUE.email,
      expect.objectContaining({
        connection: expect.anything(),
        defaultJobOptions: getDefaultJobOptions(),
      }),
    );
  });

  it('enqueues a job using its type as the job name and forwards jobId', async () => {
    const queue = new EmailQueue();
    const job: EmailJob = { type: 'welcome', to: 'user@example.com', name: 'User' };

    await queue.enqueue(job, { jobId: 'event-1' });

    const instance = (Queue as unknown as jest.Mock).mock.instances[0];
    expect(instance.add).toHaveBeenCalledWith('welcome', job, { jobId: 'event-1' });
  });

  it('enqueues without a jobId when none is provided', async () => {
    const queue = new EmailQueue();
    const job: EmailJob = { type: 'password-reset', to: 'user@example.com' };

    await queue.enqueue(job);

    const instance = (Queue as unknown as jest.Mock).mock.instances[0];
    expect(instance.add).toHaveBeenCalledWith('password-reset', job, { jobId: undefined });
  });

  it('closes the underlying queue', async () => {
    const queue = new EmailQueue();

    await queue.close();

    const instance = (Queue as unknown as jest.Mock).mock.instances[0];
    expect(instance.close).toHaveBeenCalledTimes(1);
  });
});
