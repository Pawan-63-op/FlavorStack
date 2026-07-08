import { CacheStore } from '../CacheStore';
import { logger } from '../../observability/logger';
import {
  IFulfillmentReadCache,
  IFulfillmentCacheInvalidator,
} from '../../../domain/fulfillment/services/IFulfillmentCache';

export interface FulfillmentCacheTtls {
  /** Per-fulfillment customer tracking view. */
  trackingSeconds: number;
  /** Admin dashboard pages (collection-scoped, generation-rotated). */
  dashboardSeconds: number;
}

export const DEFAULT_FULFILLMENT_CACHE_TTLS: FulfillmentCacheTtls = {
  trackingSeconds: 30,
  dashboardSeconds: 15,
};

const PREFIX = 'fulfillment';
const GENERATION_KEY = `${PREFIX}:generation`;

export class FulfillmentCache implements IFulfillmentReadCache, IFulfillmentCacheInvalidator {
  constructor(
    private readonly cache: CacheStore,
    private readonly ttls: FulfillmentCacheTtls = DEFAULT_FULFILLMENT_CACHE_TTLS
  ) {}

  private trackingKey(fulfillmentId: string): string {
    return `${PREFIX}:tracking:${fulfillmentId}`;
  }

  private dashboardKey(generation: number, discriminator: string): string {
    return `${PREFIX}:dashboard:g${generation}:${discriminator}`;
  }

  /** Current dashboard generation; absent counter (or Redis down) reads as 0 (cold start). */
  async currentGeneration(): Promise<number> {
    return (await this.cache.get<number>(GENERATION_KEY)) ?? 0;
  }

  private async remember<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    let cached: T | null = null;
    try {
      cached = await this.cache.get<T>(key);
    } catch (err) {
      logger.warn({ event: 'fulfillment.cache.read_failed', key, err }, 'cache read failed — serving from source');
      return loader();
    }
    if (cached !== null) return cached;

    const value = await loader(); // source error here is real and must propagate
    try {
      await this.cache.set(key, value, ttlSeconds);
    } catch (err) {
      logger.warn({ event: 'fulfillment.cache.write_failed', key, err }, 'cache write failed — value served uncached');
    }
    return value;
  }

  rememberTracking<T>(fulfillmentId: string, loader: () => Promise<T>): Promise<T> {
    return this.remember(this.trackingKey(fulfillmentId), this.ttls.trackingSeconds, loader);
  }

  async rememberDashboard<T>(discriminator: string, loader: () => Promise<T>): Promise<T> {
    let generation = 0;
    try {
      generation = await this.currentGeneration();
    } catch (err) {
      logger.warn({ event: 'fulfillment.cache.generation_failed', err }, 'cache generation read failed — serving from source');
      return loader();
    }
    return this.remember(this.dashboardKey(generation, discriminator), this.ttls.dashboardSeconds, loader);
  }

  async invalidateFulfillment(fulfillmentId: string): Promise<void> {
    try {
      await this.cache.del(this.trackingKey(fulfillmentId));
      await this.cache.incr(GENERATION_KEY);
    } catch (err) {
      logger.warn(
        { event: 'fulfillment.cache.invalidate_failed', fulfillmentId, err },
        'cache invalidation failed — relying on TTL expiry'
      );
    }
  }
}
