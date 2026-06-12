// BullMQ Queue implementation of IEmailQueue — producer side of `email-queue`.
import { Queue } from 'bullmq';

import { IEmailQueue } from '../../../application/shared/queues/IEmailQueue';
import { EmailJob, EnqueueOptions } from '../../../application/shared/queues/jobs';
import { getBullConnection, getDefaultJobOptions, QUEUE } from '../../../config/bullmq';

export class EmailQueue implements IEmailQueue {
  private readonly queue: Queue<EmailJob>;

  constructor() {
    this.queue = new Queue<EmailJob>(QUEUE.email, {
      connection: getBullConnection(),
      defaultJobOptions: getDefaultJobOptions(),
    });
  }

  async enqueue(job: EmailJob, opts?: EnqueueOptions): Promise<void> {
    await this.queue.add(job.type, job, { jobId: opts?.jobId });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
