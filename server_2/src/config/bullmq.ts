import type { ConnectionOptions, JobsOptions } from 'bullmq';
import { getRedisConfig } from './redis';

/**
 * Two queues, one reason each: outbound HTTP that must retry with backoff (`email`), and
 * delayed execution with no alternative mechanism (`fulfillment` — rider-offer expiry and
 * SLA timeouts). Phase 8 removed `dead-letter-queue`; see `getDefaultJobOptions()`.
 */
export const QUEUE = {
  email: 'email-queue',
  fulfillment: 'fulfillment-queue',
} as const;

export type QueueName = (typeof QUEUE)[keyof typeof QUEUE];

/**
 * BullMQ's blocking commands require `maxRetriesPerRequest: null` and
 * `enableReadyCheck: false` — using the shared `RedisClient` config as-is
 * would throw at boot.
 */
export function getBullConnection(): ConnectionOptions {
  const config = getRedisConfig();

  return {
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db,
    tls: config.tls ? {} : undefined,
    keyPrefix: config.keyPrefix,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

/**
 * `removeOnFail: false` is what replaced the dead-letter queue in Phase 8. An exhausted job
 * stays in `bull:<queue>:failed` with its payload, `failedReason` and `attemptsMade` — the
 * whole of what `DeadLetterPayload` used to copy — and is readable via `queue.getFailed()`
 * or the `f=` column in `ops/monitor.sh`. The old DLQ had three producers and no consumer.
 */
export function getDefaultJobOptions(): JobsOptions {
  return {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: false,
  };
}
