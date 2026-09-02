import { logger } from '../infrastructure/observability/logger';
import { run as runRelayWorker } from './relay.worker';
import { run as runJobsWorker } from './jobs.worker';

/**
 * Two processes, deliberately no back-compat aliases: a container still carrying
 * `WORKER_TYPE=outbox|email|fulfillment` must fail loudly at boot rather than silently
 * doing nothing. The throw below names the valid set.
 */
const RUNNERS: Record<string, () => Promise<void>> = {
  relay: runRelayWorker,
  jobs: runJobsWorker,
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
