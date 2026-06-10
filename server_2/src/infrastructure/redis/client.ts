// ioredis client — singleton, reconnect strategy, health-check method
import Redis from 'ioredis';
import { getRedisConfig, RedisConfig } from '../../config/redis';
import { logger } from '../observability/logger';

const RECONNECT_BACKOFF_STEP_MS = 200;
const RECONNECT_BACKOFF_CAP_MS = 5000;
const SHUTDOWN_TIMEOUT_MS = 5000;

export class RedisClient {
  private readonly client: Redis;

  constructor(config: RedisConfig = getRedisConfig()) {
    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      tls: config.tls ? {} : undefined,
      keyPrefix: config.keyPrefix,
      connectTimeout: config.connectTimeoutMs,
      maxRetriesPerRequest: config.maxRetriesPerRequest,
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * RECONNECT_BACKOFF_STEP_MS, RECONNECT_BACKOFF_CAP_MS),
      reconnectOnError: (err) => err.message.includes('READONLY'),
    });

    this.attachListeners();
  }

  private attachListeners(): void {
    this.client.on('connect', () => {
      logger.info({ event: 'redis.connect' }, 'Redis connecting');
    });

    this.client.on('ready', () => {
      logger.info({ event: 'redis.ready' }, 'Redis connection ready');
    });

    this.client.on('error', (err: Error) => {
      logger.error({ event: 'redis.error', err }, 'Redis connection error');
    });

    this.client.on('close', () => {
      logger.warn({ event: 'redis.close' }, 'Redis connection closed');
    });

    this.client.on('reconnecting', (delay: number) => {
      logger.warn({ event: 'redis.reconnecting', delay }, 'Redis reconnecting');
    });

    this.client.on('end', () => {
      logger.warn({ event: 'redis.end' }, 'Redis connection ended');
    });
  }

  /** Connects and resolves on `ready`; rejects on the first `error` during bootstrap (fail-fast). */
  async connect(): Promise<void> {
    if (this.client.status === 'ready') {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const onReady = (): void => {
        this.client.off('error', onError);
        resolve();
      };

      const onError = (err: Error): void => {
        this.client.off('ready', onReady);
        reject(err);
      };

      this.client.once('ready', onReady);
      this.client.once('error', onError);
      this.client.connect().catch(onError);
    });
  }

  /** Drains in-flight commands via `quit()`, waits for the connection to fully close; falls back to `disconnect()` if it doesn't finish in time. */
  async shutdown(): Promise<void> {
    if (this.client.status === 'end') {
      return;
    }

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        logger.warn({ event: 'redis.shutdown.timeout' }, 'Redis quit timed out, forcing disconnect');
        this.client.disconnect();
      }, SHUTDOWN_TIMEOUT_MS);

      this.client.once('end', () => {
        clearTimeout(timer);
        resolve();
      });

      void this.client.quit().catch(() => {
        // 'end' (above) or the disconnect() fallback resolves this promise either way
      });
    });
  }

  async ping(): Promise<boolean> {
    try {
      const reply = await this.client.ping();
      return reply === 'PONG';
    } catch (err) {
      logger.error({ event: 'redis.ping.error', err }, 'Redis ping failed');
      return false;
    }
  }

  isReady(): boolean {
    return this.client.status === 'ready';
  }

  getClient(): Redis {
    return this.client;
  }
}
