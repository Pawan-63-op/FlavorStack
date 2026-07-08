import { bootstrap, shutdown } from '../container';
import { buildFulfillmentWorkerDeps } from '../container/worker.container';
import { FulfillmentWorker } from '../infrastructure/workers/fulfillment/FulfillmentWorker';
import { runWorker } from './shared/runWorker';
import { logger } from '../infrastructure/observability/logger';

export async function run(): Promise<void> {
  const app = await bootstrap({ startOutboxProcessor: false });
  const deps = buildFulfillmentWorkerDeps();
  const worker = new FulfillmentWorker(
    app.fulfillment.fulfillmentJobHandler,
    deps.dlqHandler,
    deps.jobLogger
  );

  logger.info({ worker: 'fulfillment' }, 'worker ready');

  runWorker(async () => {
    logger.info({ worker: 'fulfillment' }, 'worker draining');
    await worker.close();
    await deps.dlqQueue.close();
    await shutdown(app);
  });
}
