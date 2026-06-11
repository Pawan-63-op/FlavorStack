// Calls bootstrap() → createApp → listen, with graceful shutdown on SIGTERM/SIGINT
import { bootstrap, shutdown } from './container';
import { createApp } from './app';
import { logger } from './infrastructure/observability/logger';

async function main(): Promise<void> {
  const app = await bootstrap();
  const expressApp = createApp(app);

  const port = Number(process.env.PORT ?? 3000);
  const server = expressApp.listen(port, () => {
    logger.info({ port }, 'server listening');
  });

  let shuttingDown = false;
  const onSignal = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, 'shutting down');
    server.close(() => {
      shutdown(app)
        .then(() => process.exit(0))
        .catch((err) => {
          logger.error({ err }, 'error during shutdown');
          process.exit(1);
        });
    });
  };

  process.on('SIGTERM', () => onSignal('SIGTERM'));
  process.on('SIGINT', () => onSignal('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'failed to start server');
  process.exit(1);
});
