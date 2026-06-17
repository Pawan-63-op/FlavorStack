jest.mock('bullmq', () => ({ Queue: jest.fn() }));

import { Queue } from 'bullmq';
import { NotifyQueue } from '../../../../../infrastructure/workers/notification/NotifyQueue';
import { QUEUE, getDefaultJobOptions } from '../../../../../config/bullmq';
import { NotificationJob } from '../../../../../application/shared/queues/jobs';

describe('NotifyQueue', () => {
  beforeEach(() => {
    (Queue as unknown as jest.Mock).mockImplementation(function (this: { add: jest.Mock; close: jest.Mock }) {
      this.add = jest.fn().mockResolvedValue(undefined);
      this.close = jest.fn().mockResolvedValue(undefined);
    });
  });

  it('constructs a BullMQ Queue for notification-queue with default job options', () => {
    new NotifyQueue();

    expect(Queue).toHaveBeenCalledWith(
      QUEUE.notification,
      expect.objectContaining({
        connection: expect.anything(),
        defaultJobOptions: getDefaultJobOptions(),
      }),
    );
  });

  it('enqueues a job using its type as the job name and forwards jobId', async () => {
    const queue = new NotifyQueue();
    const job: NotificationJob = { type: 'push', token: 'device-token', title: 'Hi', body: 'There' };

    await queue.enqueue(job, { jobId: 'event-1' });

    const instance = (Queue as unknown as jest.Mock).mock.instances[0];
    expect(instance.add).toHaveBeenCalledWith('push', job, { jobId: 'event-1' });
  });

  it('closes the underlying queue', async () => {
    const queue = new NotifyQueue();

    await queue.close();

    const instance = (Queue as unknown as jest.Mock).mock.instances[0];
    expect(instance.close).toHaveBeenCalledTimes(1);
  });
});
