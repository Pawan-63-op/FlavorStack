// Calls bootstrap() → createApp → listen, with graceful shutdown on SIGTERM/SIGINT.
// Phase 7: after the HTTP server is listening, attaches the Socket.IO `/tracking` realtime layer
// (Redis adapter for multi-instance fan-out) and binds it to the container's late-bound broadcaster.
import { bootstrap, shutdown } from './container';
import { createApp } from './app';
import { createSocketServer, SocketServerHandle } from './infrastructure/realtime/SocketServer';
import { logger } from './infrastructure/observability/logger';

async function main(): Promise<void> {
  // The OutboxWorker process owns the poller (Phase 11) — the API runs HTTP only.
  const app = await bootstrap({ startOutboxProcessor: false });
  const expressApp = createApp(app);

  const port = Number(process.env.PORT ?? 3000);
  const server = expressApp.listen(port, () => {
    logger.info({ port }, 'server listening');
  });

  // Realtime tracking. Guarded on the realtime use-cases being wired (always true in a real
  // bootstrap; absent in tests that mock the container) so the entrypoint stays test-friendly.
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
