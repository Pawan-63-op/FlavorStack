import { Job, Worker } from 'bullmq';

import { FulfillmentJob } from '../../../application/fulfillment/jobs/FulfillmentJob';
import { FulfillmentJobHandler } from '../../../application/fulfillment/jobs/FulfillmentJobHandler';
import { getBullConnection, getDefaultJobOptions, QUEUE } from '../../../config/bullmq';
import { DLQHandler } from '../shared/DLQHandler';
import { JobLogger } from '../shared/JobLogger';

export class FulfillmentWorker {
  private readonly worker: Worker<FulfillmentJob>;

  constructor(
    private readonly handler: FulfillmentJobHandler,
    dlqHandler: DLQHandler,
    jobLogger: JobLogger
  ) {
    this.worker = new Worker<FulfillmentJob>(QUEUE.fulfillment, (job) => this.process(job), {
      connection: getBullConnection(),
    });

    jobLogger.register(this.worker);

    this.worker.on('failed', (job, err) => {
      if (!job) return;
      const maxAttempts = job.opts.attempts ?? getDefaultJobOptions().attempts ?? 1;
      if (job.attemptsMade >= maxAttempts) {
        void dlqHandler.handle(QUEUE.fulfillment, job, err);
      }
    });
  }

  async process(job: Job<FulfillmentJob>): Promise<void> {
    await this.handler.handle(job.data);
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
