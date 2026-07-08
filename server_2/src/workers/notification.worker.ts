import { bootstrap, shutdown } from '../container';
import { buildNotificationWorkerDeps } from '../container/worker.container';
import { NotifyWorker } from '../infrastructure/workers/notification/NotifyWorker';
import { NotificationDispatcher } from '../infrastructure/notifications/NotificationDispatcher';
import { PushChannel } from '../infrastructure/notifications/PushChannel';
import { EmailChannel } from '../infrastructure/notifications/EmailChannel';
import { IdentityRecipientResolver } from '../infrastructure/notifications/IdentityRecipientResolver';
import { runWorker } from './shared/runWorker';
import { logger } from '../infrastructure/observability/logger';

export async function run(): Promise<void> {
  const app = await bootstrap({ startOutboxProcessor: false });
  const deps = buildNotificationWorkerDeps();

  const recipientResolver = new IdentityRecipientResolver(app.identity.userRepository);
  const notificationDispatcher = new NotificationDispatcher(app.engagement.notificationRepository, [
    new PushChannel(deps.pushProvider, recipientResolver),
    new EmailChannel(app.auth.emailProvider, recipientResolver),
  ]);

  const worker = new NotifyWorker(deps.pushProvider, notificationDispatcher, deps.dlqHandler, deps.jobLogger);

  logger.info({ worker: 'notification' }, 'worker ready');

  runWorker(async () => {
    logger.info({ worker: 'notification' }, 'worker draining');
    await worker.close();
    await deps.dlqQueue.close();
    await shutdown(app);
  });
}
