// OutboxProcessor poll interval, batch size, retry/backoff config
export interface OutboxConfig {
  pollIntervalMs: number;
  batchSize: number;
  maxRetries: number;
  backoffBaseMs: number;
}

export function getOutboxConfig(): OutboxConfig {
  return {
    pollIntervalMs: Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 2000),
    batchSize: Number(process.env.OUTBOX_BATCH_SIZE ?? 100),
    maxRetries: Number(process.env.OUTBOX_MAX_RETRIES ?? 5),
    backoffBaseMs: Number(process.env.OUTBOX_BACKOFF_BASE_MS ?? 1000),
  };
}
