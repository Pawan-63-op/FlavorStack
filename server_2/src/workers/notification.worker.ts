// NotificationWorker process — consumes `notification-queue`.
//  - `push`       jobs → direct IPushProvider send.
//  - `engagement` jobs → routed through the app graph's NotificationDispatcher (channel abstraction +
//                        markSent/markFailed lifecycle, Phase 4).
//
// Like fulfillment.worker.ts, it bootstraps the full graph with `startOutboxProcessor: false` (the
// OutboxWorker owns the poller) so the dispatcher has the wired NotificationRepository + recipient
// resolver, then pulls `notificationDispatcher` off the container.
import { bootstrap, shutdown } from '../container';
import { buildNotificationWorkerDeps } from '../container/worker.container';
import { NotifyWorker } from '../infrastructure/workers/notification/NotifyWorker';
import { runWorker } from './shared/runWorker';
import { logger } from '../infrastructure/observability/logger';

export async function run(): Promise<void> {
  const app = await bootstrap({ startOutboxProcessor: false });
  const deps = buildNotificationWorkerDeps();
  const worker = new NotifyWorker(deps.pushProvider, app.notificationDispatcher, deps.dlqHandler, deps.jobLogger);

  logger.info({ worker: 'notification' }, 'worker ready');

  runWorker(async () => {
    logger.info({ worker: 'notification' }, 'worker draining');
    await worker.close();
    await deps.dlqQueue.close();
    await shutdown(app);
  });
}
