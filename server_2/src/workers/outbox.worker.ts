// OutboxWorker process — drives the existing OutboxProcessor (Phase 8) in isolation
// from the API. Bootstraps the full Identity graph with `startOutboxProcessor: false`
// so it owns the single poller, and tears the whole graph down on shutdown.
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
