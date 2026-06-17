// BullMQ producer for the Fulfillment delayed jobs — concrete IFulfillmentJobScheduler over
// QUEUE.fulfillment (fulfillment_module.md §10, Phase 5B). Jobs are enqueued with a `delay` so they
// become due at the offer TTL / SLA deadline, and a stable `jobId` so an at-least-once re-arm is de-duped.
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
