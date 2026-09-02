import { bootstrapWorker, shutdown } from '../container';
import { runWorker } from './shared/runWorker';
import { logger } from '../infrastructure/observability/logger';

export async function run(): Promise<void> {
  const app = await bootstrapWorker('relay');
  app.outboxProcessor.start();

  logger.info({ worker: 'relay' }, 'worker ready');

  runWorker(async () => {
    logger.info({ worker: 'relay' }, 'worker draining');
    await shutdown(app);
  });
}
