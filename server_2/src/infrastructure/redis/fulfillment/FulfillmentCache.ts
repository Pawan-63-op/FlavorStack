// FulfillmentCache — Redis-backed cache-aside + event-driven invalidation for the fulfillment
// read side (fulfillment_module.md §12 Phase 9 / Batch 9.1). Mirrors CatalogCache.
//
// Two key families:
//   • Per-fulfillment tracking key (`tracking:{id}`) is invalidated directly by id when that
//     fulfillment's projection changes.
//   • The admin dashboard list (`dashboard:g{gen}:{discriminator}`) embeds a monotonic GENERATION
//     counter. Its content depends on many fulfillments and filters, so the keys can't be
//     enumerated to delete; instead invalidation bumps the generation, orphaning every old key at
//     once. Old keys carry short TTLs and expire on their own.
//
// Ordering guarantee: the projector applies the projection write FIRST, then calls
// `invalidateFulfillment`. So a read after invalidation always repopulates from the committed,
// up-to-date projection — no stale read survives a write.
//
// Resilience (Batch 9.4): the cache is a pure optimization, never a hard dependency. Every Redis
// operation is wrapped so that a Redis outage degrades to a direct source read (read path) or a
// best-effort no-op (invalidation) instead of failing the request / projection write. A read-miss
// that can't be cached still serves the freshly loaded value.
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

  // ── key builders ─────────────────────────────────────────────
  private trackingKey(fulfillmentId: string): string {
    return `${PREFIX}:tracking:${fulfillmentId}`;
  }

  private dashboardKey(generation: number, discriminator: string): string {
    return `${PREFIX}:dashboard:g${generation}:${discriminator}`;
  }

  // ── generation ───────────────────────────────────────────────
  /** Current dashboard generation; absent counter (or Redis down) reads as 0 (cold start). */
  async currentGeneration(): Promise<number> {
    return (await this.cache.get<number>(GENERATION_KEY)) ?? 0;
  }

  // ── resilient cache-aside ────────────────────────────────────
  // Read-through that NEVER lets a Redis fault fail the caller: on any cache error it serves the
  // freshly loaded source value. Only a genuine source (DB) error propagates.
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

  // ── IFulfillmentReadCache ────────────────────────────────────
  rememberTracking<T>(fulfillmentId: string, loader: () => Promise<T>): Promise<T> {
    return this.remember(this.trackingKey(fulfillmentId), this.ttls.trackingSeconds, loader);
  }

  async rememberDashboard<T>(discriminator: string, loader: () => Promise<T>): Promise<T> {
    let generation = 0;
    try {
      generation = await this.currentGeneration();
    } catch (err) {
      // Generation lookup is itself a Redis read — if it fails, skip the cache entirely.
      logger.warn({ event: 'fulfillment.cache.generation_failed', err }, 'cache generation read failed — serving from source');
      return loader();
    }
    return this.remember(this.dashboardKey(generation, discriminator), this.ttls.dashboardSeconds, loader);
  }

  // ── IFulfillmentCacheInvalidator ─────────────────────────────
  // Best-effort: a cache failure must not break projection maintenance (the projector calls this
  // AFTER the projection write has committed). Worst case a stale entry lingers until its short TTL.
  async invalidateFulfillment(fulfillmentId: string): Promise<void> {
    try {
      // Drop this fulfillment's tracking key...
      await this.cache.del(this.trackingKey(fulfillmentId));
      // ...and rotate every dashboard page in one shot.
      await this.cache.incr(GENERATION_KEY);
    } catch (err) {
      logger.warn(
        { event: 'fulfillment.cache.invalidate_failed', fulfillmentId, err },
        'cache invalidation failed — relying on TTL expiry'
      );
    }
  }
}
