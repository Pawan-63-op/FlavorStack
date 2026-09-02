export interface OutboxConfig {
  pollIntervalMs: number;
  batchSize: number;
  maxRetries: number;
  backoffBaseMs: number;
  /** How long a claimed (PROCESSING) row may stay locked before the reaper
   *  returns it to PENDING. Must exceed the slowest expected handler. */
  leaseMs: number;
}

export function getOutboxConfig(): OutboxConfig {
  return {
    pollIntervalMs: Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 2000),
    batchSize: Number(process.env.OUTBOX_BATCH_SIZE ?? 100),
    maxRetries: Number(process.env.OUTBOX_MAX_RETRIES ?? 5),
    backoffBaseMs: Number(process.env.OUTBOX_BACKOFF_BASE_MS ?? 1000),
    leaseMs: Number(process.env.OUTBOX_LEASE_MS ?? 60000),
  };
}
