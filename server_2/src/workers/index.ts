// Worker process entrypoint — selects a worker via WORKER_TYPE (outbox|email|notification).
// One image (`Dockerfile.worker`), env-selected process per the Phase 11 plan.
import { logger } from '../infrastructure/observability/logger';
import { run as runOutboxWorker } from './outbox.worker';
import { run as runEmailWorker } from './email.worker';
import { run as runNotificationWorker } from './notification.worker';

const RUNNERS: Record<string, () => Promise<void>> = {
  outbox: runOutboxWorker,
  email: runEmailWorker,
  notification: runNotificationWorker,
};

export async function main(): Promise<void> {
  const workerType = process.env.WORKER_TYPE ?? '';
  const run = RUNNERS[workerType];

  if (!run) {
    throw new Error(
      `Unknown WORKER_TYPE: "${workerType}". Expected one of: ${Object.keys(RUNNERS).join(', ')}`,
    );
  }

  await run();
}

if (require.main === module) {
  main().catch((err) => {
    logger.error({ err }, 'failed to start worker');
    process.exit(1);
  });
}
