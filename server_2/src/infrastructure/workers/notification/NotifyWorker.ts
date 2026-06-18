// BullMQ Worker consuming `notification-queue`.
//  - `push`       jobs → fire-and-forget IPushProvider call (legacy direct push, unchanged).
//  - `engagement` jobs → NotificationDispatcher loads the persisted Notification, routes it through the
//                        channel abstraction, and marks it SENT/FAILED (Phase 4).
//
// Retry/lifecycle: a transient failure throws out of `process`, so BullMQ retries the still-PENDING row.
// Once attempts are exhausted, the `failed` handler routes the job to the DLQ and — for engagement jobs —
// asks the dispatcher to settle the row as FAILED (markExhausted).
import { Job, Worker } from 'bullmq';

import { IPushProvider } from '../../external/push/IPushProvider';
import { NotificationDispatcher } from '../../notifications/NotificationDispatcher';
import { NotificationJob } from '../../../application/shared/queues/jobs';
import { getBullConnection, QUEUE } from '../../../config/bullmq';
import { DLQHandler } from '../shared/DLQHandler';
import { JobLogger } from '../shared/JobLogger';

export class NotifyWorker {
  private readonly worker: Worker<NotificationJob>;

  constructor(
    private readonly pushProvider: IPushProvider,
    private readonly dispatcher: NotificationDispatcher,
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
      if (job.attemptsMade < maxAttempts) return;

      void dlqHandler.handle(QUEUE.notification, job, err);

      // Exhausted engagement job: settle the still-PENDING notification row as FAILED.
      if (job.data?.type === 'engagement') {
        void this.dispatcher.markExhausted(job.data.notificationId, err.message);
      }
    });
  }

  async process(job: Job<NotificationJob>): Promise<void> {
    const data = job.data;

    switch (data.type) {
      case 'push':
        await this.pushProvider.sendPush(data.token, data.title, data.body, data.data);
        return;
      case 'engagement':
        await this.dispatcher.dispatch(data.notificationId, data.channel);
        return;
    }
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
