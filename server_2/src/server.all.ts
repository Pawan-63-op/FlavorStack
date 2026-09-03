import { QUEUE } from './config/bullmq';
import { bootstrap, shutdown } from './container';
import { buildEmailWorkerDeps } from './container/worker.container';
import { createApp } from './app';
import { createSocketServer, SocketServerHandle } from './infrastructure/realtime/SocketServer';
import { EmailWorker } from './infrastructure/workers/email/EmailWorker';
import { FulfillmentWorker } from './infrastructure/workers/fulfillment/FulfillmentWorker';
import { JobLogger } from './infrastructure/workers/shared/JobLogger';
import { logger } from './infrastructure/observability/logger';

/**
 * The single-process entrypoint: api + relay + jobs in one Node process.
 *
 * Render's free tier bills background workers separately, so the three profiles that
 * `docker-compose.prod.yml` runs as separate containers have to share one process there. The
 * merge is cheap because all three already build from the same `buildWorkerCore()`; the only
 * things the two worker profiles add over the api are the outbox poller (a `bootstrap` option)
 * and the two BullMQ consumers constructed below.
 *
 * Deliberately **not** under `src/workers/` and **not** a third `RUNNERS` key: that directory is
 * pinned to exactly the two entrypoints by `worker-fitness.test.ts`, and everything there is
 * forbidden from importing the full `bootstrap` — which is precisely what this file must do.
 *
 * `bootstrap()` is called **once**. `connectDB` is a mongoose global singleton and
 * `createEventContainer()` returns a fresh bus per call, so a second bootstrap would wire the
 * identity and driver-assignment handlers onto an orphan bus and silently drop those events.
 */
async function main(): Promise<void> {
  // Deliberately before `bootstrap`, as `jobs.worker.ts` does: a missing Resend key should
  // fail the process immediately, not after Mongo and Redis have connected.
  const emailDeps = buildEmailWorkerDeps();

  const app = await bootstrap({ startOutboxProcessor: true });

  const email = new EmailWorker(emailDeps.emailProvider, emailDeps.jobLogger);
  const fulfillment = new FulfillmentWorker(
    app.fulfillment.fulfillmentJobHandler,
    new JobLogger(QUEUE.fulfillment),
  );

  logger.info({ worker: 'jobs', queues: [QUEUE.email, QUEUE.fulfillment] }, 'worker ready');
  logger.info({ worker: 'relay' }, 'worker ready');

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

  // One shutdown path only. `runWorker()` registers its own SIGTERM/SIGINT handlers, so the
  // BullMQ workers are closed from here instead — two registrations would race to `process.exit`.
  let shuttingDown = false;
  const onSignal = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, 'shutting down');
    server.close(() => {
      Promise.resolve(socketServer?.close())
        .then(() => Promise.all([email.close(), fulfillment.close()]))
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
