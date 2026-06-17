import { getOutboxConfig } from '../../../config/outbox';

describe('getOutboxConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns sensible defaults when no env vars are set', () => {
    delete process.env.OUTBOX_POLL_INTERVAL_MS;
    delete process.env.OUTBOX_BATCH_SIZE;
    delete process.env.OUTBOX_MAX_RETRIES;
    delete process.env.OUTBOX_BACKOFF_BASE_MS;

    expect(getOutboxConfig()).toEqual({
      pollIntervalMs: 2000,
      batchSize: 100,
      maxRetries: 5,
      backoffBaseMs: 1000,
    });
  });

  it('reads overrides from environment variables', () => {
    process.env.OUTBOX_POLL_INTERVAL_MS = '5000';
    process.env.OUTBOX_BATCH_SIZE = '50';
    process.env.OUTBOX_MAX_RETRIES = '3';
    process.env.OUTBOX_BACKOFF_BASE_MS = '500';

    expect(getOutboxConfig()).toEqual({
      pollIntervalMs: 5000,
      batchSize: 50,
      maxRetries: 3,
      backoffBaseMs: 500,
    });
  });
});
