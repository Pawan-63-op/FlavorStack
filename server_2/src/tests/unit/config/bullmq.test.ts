import { QUEUE, getBullConnection, getDefaultJobOptions } from '../../../config/bullmq';

describe('bullmq config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('QUEUE', () => {
    it('exposes the exact queue names', () => {
      expect(QUEUE).toEqual({
        email: 'email-queue',
        notification: 'notification-queue',
        dlq: 'dead-letter-queue',
        // Cross-context fan-out queues added in Catalog Phase 12 (EventRouter targets).
        commerce: 'commerce-queue',
        fulfillment: 'fulfillment-queue',
        searchReindex: 'search-reindex-queue',
        // Publish-and-park targets added in Commerce Phase 12 (no consumer yet).
        ordering: 'ordering-queue',
        payments: 'payments-queue',
      });
    });
  });

  describe('getBullConnection', () => {
    it('forces maxRetriesPerRequest null and disables ready check, using redis config defaults', () => {
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_PORT;
      delete process.env.REDIS_PASSWORD;
      delete process.env.REDIS_DB;
      delete process.env.REDIS_TLS;
      delete process.env.REDIS_KEY_PREFIX;

      expect(getBullConnection()).toEqual({
        host: '127.0.0.1',
        port: 6379,
        password: undefined,
        db: undefined,
        tls: undefined,
        keyPrefix: undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    });

    it('reflects redis env overrides while still forcing BullMQ-safe options', () => {
      process.env.REDIS_HOST = 'redis.internal';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_PASSWORD = 'secret';
      process.env.REDIS_DB = '2';
      process.env.REDIS_TLS = 'true';
      process.env.REDIS_KEY_PREFIX = 'flavorstack:';
      // even if someone tries to relax it via env, BullMQ requires null
      process.env.REDIS_MAX_RETRIES_PER_REQUEST = '7';

      expect(getBullConnection()).toEqual({
        host: 'redis.internal',
        port: 6380,
        password: 'secret',
        db: 2,
        tls: {},
        keyPrefix: 'flavorstack:',
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    });
  });

  describe('getDefaultJobOptions', () => {
    it('returns 3 attempts with exponential backoff and removeOnComplete only', () => {
      expect(getDefaultJobOptions()).toEqual({
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: false,
      });
    });
  });
});
