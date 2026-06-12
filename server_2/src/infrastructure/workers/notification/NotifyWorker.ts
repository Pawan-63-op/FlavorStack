// BullMQ Worker consuming `notification-queue` — maps NotificationJob.type to IPushProvider calls.
import { Job, Worker } from 'bullmq';

import { IPushProvider } from '../../external/push/IPushProvider';
import { NotificationJob } from '../../../application/shared/queues/jobs';
import { getBullConnection, QUEUE } from '../../../config/bullmq';
import { DLQHandler } from '../shared/DLQHandler';
import { JobLogger } from '../shared/JobLogger';

export class NotifyWorker {
  private readonly worker: Worker<NotificationJob>;

  constructor(
    private readonly pushProvider: IPushProvider,
    dlqHandler: DLQHandler,
    jobLogger: JobLogger,
  ) {
    this.worker = new Worker<NotificationJob>(QUEUE.notification, (job) => this.process(job), {
      connection: getBullConnection(),
    });

    jobLogger.register(this.worker);

    this.worker.on('failed', (job, err) => {
      if (!job) return;

      const maxAttempts = job.opts.attempts ?? 1;
      if (job.attemptsMade >= maxAttempts) {
        void dlqHandler.handle(QUEUE.notification, job, err);
      }
    });
  }

  async process(job: Job<NotificationJob>): Promise<void> {
    const data = job.data;

    switch (data.type) {
      case 'push':
        await this.pushProvider.sendPush(data.token, data.title, data.body, data.data);
        return;
    }
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
