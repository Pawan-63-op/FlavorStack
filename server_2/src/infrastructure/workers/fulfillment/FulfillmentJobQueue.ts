import { Queue } from 'bullmq';

import { FulfillmentJob, IFulfillmentJobScheduler, ScheduleOptions } from '../../../application/fulfillment/jobs/FulfillmentJob';
import { getBullConnection, getDefaultJobOptions, QUEUE } from '../../../config/bullmq';

export class FulfillmentJobQueue implements IFulfillmentJobScheduler {
  private readonly queue: Queue<FulfillmentJob>;

  constructor() {
    this.queue = new Queue<FulfillmentJob>(QUEUE.fulfillment, {
      connection: getBullConnection(),
      defaultJobOptions: getDefaultJobOptions(),
    });
  }

  async schedule(job: FulfillmentJob, opts: ScheduleOptions): Promise<void> {
    await this.queue.add(job.type, job, { jobId: opts.jobId, delay: opts.delayMs });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
