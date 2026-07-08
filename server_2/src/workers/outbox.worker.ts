import { bootstrap, shutdown } from '../container';
import { runWorker } from './shared/runWorker';
import { logger } from '../infrastructure/observability/logger';

export async function run(): Promise<void> {
  const app = await bootstrap({ startOutboxProcessor: false });
  app.outboxProcessor.start();

  logger.info({ worker: 'outbox' }, 'worker ready');

  runWorker(async () => {
    logger.info({ worker: 'outbox' }, 'worker draining');
    await shutdown(app);
  });
}
