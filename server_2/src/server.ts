import { bootstrap, shutdown } from './container';
import { createApp } from './app';
import { createSocketServer, SocketServerHandle } from './infrastructure/realtime/SocketServer';
import { logger } from './infrastructure/observability/logger';

async function main(): Promise<void> {
  const app = await bootstrap({ startOutboxProcessor: false });
  const expressApp = createApp(app);

  const port = Number(process.env.PORT ?? 3000);
  const server = expressApp.listen(port, () => {
    logger.info({ port }, 'server listening');
  });

  let socketServer: SocketServerHandle | undefined;
  if (app.fulfillment?.recordRiderLocation && app.fulfillment.getLiveTracking) {
    socketServer = await createSocketServer(server, app.redisClient, {
      tokenService: app.auth.tokenService,
      recordRiderLocation: app.fulfillment.recordRiderLocation,
      getLiveTracking: app.fulfillment.getLiveTracking,
      broadcaster: app.trackingBroadcaster,
    });
  }

  let shuttingDown = false;
  const onSignal = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, 'shutting down');
    server.close(() => {
      Promise.resolve(socketServer?.close())
        .then(() => shutdown(app))
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
