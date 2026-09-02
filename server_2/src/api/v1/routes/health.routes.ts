import { Router, Request, Response } from 'express';
import { Connection } from 'mongoose';
import { RedisClient } from '../../../infrastructure/redis/client';
import { logger } from '../../../infrastructure/observability/logger';
import { metrics } from '../../../infrastructure/observability/metrics';
import { renderPrometheus } from '../../../infrastructure/observability/prometheus';

/**
 * Liveness/readiness and metrics. These are the only routes in the app mounted at the **root**
 * rather than under `/api/v1`: they are operational surface, not part of the versioned API
 * contract, and container/nginx probes should not have to track an API version to reach them.
 * The factory lives here with the other route factories purely for discoverability —
 * `app.ts` mounts it at `/`.
 *
 * `/metrics` is deliberately **not** proxied by nginx in production, which is what keeps it
 * internal-only and is why it carries no auth.
 */
export interface HealthRoutesDeps {
  connection: Connection;
  redisClient: RedisClient;
  /** Overridable for tests; defaults to the Mongo-backed reader below. */
  readOutboxBacklog?: OutboxBacklogReader;
}

/** Depth and age of the relay's queue, as of the moment of the scrape. */
export interface OutboxBacklog {
  pending: number;
  processing: number;
  /** Age of the oldest PENDING row; 0 when the backlog is empty. */
  oldestPendingAgeSeconds: number;
}

export type OutboxBacklogReader = () => Promise<OutboxBacklog>;

/**
 * The one **cross-process** metric on this endpoint.
 *
 * `metrics` is a module-level singleton, so it is per-process: the api, `worker-relay` and
 * `worker-jobs` each have their own registry and worker counters can never appear here. Since
 * Phase 7.3 the relay is the sole delivery path for `OrderRequested`, which makes PENDING depth
 * and oldest-PENDING age the most informative numbers in the system — and until now they lived
 * only as three `mongosh` lines in `ops/monitor.sh`. Reading them from Mongo at scrape time
 * surfaces the relay's health on the api's endpoint without standing up a second HTTP server
 * inside each worker.
 *
 * Deliberately mirrors `ops/monitor.sh`'s outbox section query-for-query so the two agree.
 */
const OUTBOX_GAUGES = {
  pending: 'flavorstack_outbox_pending',
  processing: 'flavorstack_outbox_processing',
  oldestPendingAgeSeconds: 'flavorstack_outbox_oldest_pending_age_seconds',
} as const;

function mongoOutboxBacklogReader(connection: Connection): OutboxBacklogReader {
  return async (): Promise<OutboxBacklog> => {
    const db = connection.db;
    if (!db) throw new Error('no mongo connection');
    const outbox = db.collection('outbox');

    const [pending, processing, oldest] = await Promise.all([
      outbox.countDocuments({ status: 'PENDING' }),
      outbox.countDocuments({ status: 'PROCESSING' }),
      outbox.find({ status: 'PENDING' }).sort({ createdAt: 1 }).limit(1).next(),
    ]);

    const createdAt = oldest?.createdAt as Date | undefined;
    return {
      pending,
      processing,
      oldestPendingAgeSeconds: createdAt ? Math.max(0, Math.round((Date.now() - createdAt.getTime()) / 1000)) : 0,
    };
  };
}

/** A dependency probe must never be the reason a liveness check hangs. */
const PROBE_TIMEOUT_MS = 2000;

/** The canonical exposition-format content type; parameter order is preserved deliberately. */
const PROMETHEUS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

export function createHealthRoutes(deps: HealthRoutesDeps): Router {
  const router = Router();
  const readOutboxBacklog = deps.readOutboxBacklog ?? mongoOutboxBacklogReader(deps.connection);

  router.get('/health', async (_req: Request, res: Response): Promise<void> => {
    const [mongo, redis] = await Promise.all([
      probe(() => pingMongo(deps.connection)),
      probe(() => deps.redisClient.ping()),
    ]);

    // Same body either way, so a failing probe is diagnosable from the response alone.
    res.status(mongo && redis ? 200 : 503).json({
      status: mongo && redis ? 'ok' : 'degraded',
      uptimeSeconds: Math.floor(process.uptime()),
      checks: { mongo, redis },
    });
  });

  router.get('/metrics', async (_req: Request, res: Response): Promise<void> => {
    // Its own try/catch: a Mongo hiccup must degrade /metrics to the in-memory registry, never
    // fail the scrape. Losing three gauges is recoverable; losing every metric is not.
    let gauges: Record<string, number> = {};
    try {
      const backlog = await readOutboxBacklog();
      gauges = {
        [OUTBOX_GAUGES.pending]: backlog.pending,
        [OUTBOX_GAUGES.processing]: backlog.processing,
        [OUTBOX_GAUGES.oldestPendingAgeSeconds]: backlog.oldestPendingAgeSeconds,
      };
    } catch (err) {
      logger.warn({ event: 'metrics.outbox_backlog.failed', err }, 'Outbox backlog gauge unavailable');
    }

    // `res.send()` re-serializes the content type to inject its own charset, which sorts the
    // parameters alphabetically and mangles the canonical `version=0.0.4; charset=utf-8`
    // spelling. `end()` writes the header through untouched.
    res.setHeader('Content-Type', PROMETHEUS_CONTENT_TYPE);
    res.end(renderPrometheus(metrics.snapshot(), gauges));
  });

  return router;
}

async function pingMongo(connection: Connection): Promise<boolean> {
  const db = connection.db;
  if (!db) return false;
  await db.admin().command({ ping: 1 });
  return true;
}

/** Resolves false on throw or timeout — one slow dependency cannot stall the probe. */
async function probe(check: () => Promise<boolean>): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      check(),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), PROBE_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
