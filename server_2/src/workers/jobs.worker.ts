import { QUEUE } from '../config/bullmq';
import { bootstrapWorker, shutdown } from '../container';
import { buildEmailWorkerDeps } from '../container/worker.container';
import { EmailWorker } from '../infrastructure/workers/email/EmailWorker';
import { FulfillmentWorker } from '../infrastructure/workers/fulfillment/FulfillmentWorker';
import { JobLogger } from '../infrastructure/workers/shared/JobLogger';
import { runWorker } from './shared/runWorker';
import { logger } from '../infrastructure/observability/logger';

/**
 * The single BullMQ consumer process: one `Worker` per queue, both in-process. BullMQ already
 * isolates failures per queue, so a poisoned email job cannot stall the fulfillment timeouts —
 * two containers bought nothing that the two `Worker`s do not already give.
 */
export async function run(): Promise<void> {
  // Deliberately before `bootstrapWorker`: a missing Resend key should fail the process
  // immediately, not after Mongo and Redis have connected.
  const emailDeps = buildEmailWorkerDeps();
  const app = await bootstrapWorker('jobs');

  const email = new EmailWorker(emailDeps.emailProvider, emailDeps.jobLogger);
  const fulfillment = new FulfillmentWorker(
    app.fulfillment.fulfillmentJobHandler,
    new JobLogger(QUEUE.fulfillment),
  );

  logger.info({ worker: 'jobs', queues: [QUEUE.email, QUEUE.fulfillment] }, 'worker ready');

  runWorker(async () => {
    logger.info({ worker: 'jobs' }, 'worker draining');
    await Promise.all([email.close(), fulfillment.close()]);
    await shutdown(app);
  });
}
