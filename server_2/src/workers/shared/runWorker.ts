import { logger } from '../../infrastructure/observability/logger';

const SHUTDOWN_TIMEOUT_MS = 10000;

/**
 * Registers SIGTERM/SIGINT handlers that run `shutdown()` once, force-exiting after
 * `SHUTDOWN_TIMEOUT_MS` if it hangs, and traps unhandledRejection/uncaughtException so a
 * crash is logged instead of silently killing the process.
 */
export function runWorker(shutdown: () => Promise<void>): void {
  let shuttingDown = false;

  const onSignal = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, 'worker shutting down');

    const timer = setTimeout(() => {
      logger.error({ event: 'worker.shutdown.timeout' }, 'worker shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    shutdown()
      .then(() => {
        clearTimeout(timer);
        process.exit(0);
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        logger.error({ err }, 'worker shutdown failed');
        process.exit(1);
      });
  };

  process.on('SIGTERM', () => onSignal('SIGTERM'));
  process.on('SIGINT', () => onSignal('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'worker unhandled rejection');
  });

  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'worker uncaught exception');
  });
}
