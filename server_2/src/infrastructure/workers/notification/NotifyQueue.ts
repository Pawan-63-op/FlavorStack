// BullMQ Queue implementation of INotificationQueue — producer side of `notification-queue`.
import { Queue } from 'bullmq';

import { INotificationQueue } from '../../../application/shared/queues/INotificationQueue';
import { NotificationJob, EnqueueOptions } from '../../../application/shared/queues/jobs';
import { getBullConnection, getDefaultJobOptions, QUEUE } from '../../../config/bullmq';

export class NotifyQueue implements INotificationQueue {
  private readonly queue: Queue<NotificationJob>;

  constructor() {
    this.queue = new Queue<NotificationJob>(QUEUE.notification, {
      connection: getBullConnection(),
      defaultJobOptions: getDefaultJobOptions(),
    });
  }

  async enqueue(job: NotificationJob, opts?: EnqueueOptions): Promise<void> {
    await this.queue.add(job.type, job, { jobId: opts?.jobId });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
