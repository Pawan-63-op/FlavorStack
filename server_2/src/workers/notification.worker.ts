// NotificationWorker process — consumes `notification-queue` and sends via IPushProvider.
import { buildNotificationWorkerDeps } from '../container/worker.container';
import { NotifyWorker } from '../infrastructure/workers/notification/NotifyWorker';
import { runWorker } from './shared/runWorker';
import { logger } from '../infrastructure/observability/logger';

export async function run(): Promise<void> {
  const deps = buildNotificationWorkerDeps();
  const worker = new NotifyWorker(deps.pushProvider, deps.dlqHandler, deps.jobLogger);

  logger.info({ worker: 'notification' }, 'worker ready');

  runWorker(async () => {
    logger.info({ worker: 'notification' }, 'worker draining');
    await worker.close();
    await deps.dlqQueue.close();
  });
}
