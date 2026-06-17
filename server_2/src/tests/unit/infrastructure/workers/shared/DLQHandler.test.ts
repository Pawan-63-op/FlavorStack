import type { Job, Queue } from 'bullmq';
import { DLQHandler } from '../../../../../infrastructure/workers/shared/DLQHandler';
import { QUEUE } from '../../../../../config/bullmq';

describe('DLQHandler', () => {
  it('enqueues a dead-letter payload describing the failed job', async () => {
    const add = jest.fn().mockResolvedValue(undefined);
    const dlqQueue = { add } as unknown as Queue;
    const handler = new DLQHandler(dlqQueue);

    const job = {
      name: 'welcome',
      data: { to: 'user@example.com' },
      attemptsMade: 3,
    } as unknown as Job;

    await handler.handle(QUEUE.email, job, new Error('Resend API unreachable'));

    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(QUEUE.dlq, {
      sourceQueue: QUEUE.email,
      jobName: 'welcome',
      data: { to: 'user@example.com' },
      failedReason: 'Resend API unreachable',
      attemptsMade: 3,
    });
  });
});
