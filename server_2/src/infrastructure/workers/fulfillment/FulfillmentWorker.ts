import { Job, Worker } from 'bullmq';

import { FulfillmentJob } from '../../../application/fulfillment/jobs/FulfillmentJob';
import { FulfillmentJobHandler } from '../../../application/fulfillment/jobs/FulfillmentJobHandler';
import { getBullConnection, QUEUE } from '../../../config/bullmq';
import { JobLogger } from '../shared/JobLogger';

export class FulfillmentWorker {
  private readonly worker: Worker<FulfillmentJob>;

  constructor(
    private readonly handler: FulfillmentJobHandler,
    jobLogger: JobLogger
  ) {
    this.worker = new Worker<FulfillmentJob>(QUEUE.fulfillment, (job) => this.process(job), {
      connection: getBullConnection(),
    });

    // An exhausted job is retained by `removeOnFail: false` and logged by `jobLogger` — there
    // is no dead-letter copy to make (Phase 8).
    jobLogger.register(this.worker);
  }

  async process(job: Job<FulfillmentJob>): Promise<void> {
    await this.handler.handle(job.data);
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
