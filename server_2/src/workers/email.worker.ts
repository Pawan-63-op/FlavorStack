// EmailWorker process — consumes `email-queue` and sends via IEmailProvider (Resend).
import { buildEmailWorkerDeps } from '../container/worker.container';
import { EmailWorker } from '../infrastructure/workers/email/EmailWorker';
import { runWorker } from './shared/runWorker';
import { logger } from '../infrastructure/observability/logger';

export async function run(): Promise<void> {
  const deps = buildEmailWorkerDeps();
  const worker = new EmailWorker(deps.emailProvider, deps.dlqHandler, deps.jobLogger);

  logger.info({ worker: 'email' }, 'worker ready');

  runWorker(async () => {
    logger.info({ worker: 'email' }, 'worker draining');
    await worker.close();
    await deps.dlqQueue.close();
  });
}
