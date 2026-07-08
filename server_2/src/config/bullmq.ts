import type { ConnectionOptions, JobsOptions } from 'bullmq';
import { getRedisConfig } from './redis';

export const QUEUE = {
  email: 'email-queue',
  notification: 'notification-queue',
  dlq: 'dead-letter-queue',
  commerce: 'commerce-queue',
  fulfillment: 'fulfillment-queue',
  searchReindex: 'search-reindex-queue',
  ordering: 'ordering-queue',
  payments: 'payments-queue',
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

export function getDefaultJobOptions(): JobsOptions {
  return {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: false,
  };
}
