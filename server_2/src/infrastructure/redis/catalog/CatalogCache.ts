import { CacheStore } from '../CacheStore';
import {
  ICatalogCacheInvalidator,
  IServiceabilityCache,
  ServiceabilityCachePoint,
  ServiceabilityCacheSubtotal,
} from '../../../domain/catalog/services/ICatalogCache';

export interface CatalogCacheTtls {
  /** Per-restaurant summary projection. */
  summarySeconds: number;
  /** Per-restaurant full menu-view projection. */
  menuSeconds: number;
  /** Browse/list pages (collection-scoped, generation-rotated). */
  listSeconds: number;
  /** Serviceability lookups (collection-scoped, generation-rotated). */
  serviceabilitySeconds: number;
}

export const DEFAULT_CATALOG_CACHE_TTLS: CatalogCacheTtls = {
  summarySeconds: 300,
  menuSeconds: 300,
  listSeconds: 60,
  serviceabilitySeconds: 60,
};

const PREFIX = 'catalog';
const GENERATION_KEY = `${PREFIX}:generation`;

export class CatalogCache implements ICatalogCacheInvalidator, IServiceabilityCache {
  constructor(
    private readonly cache: CacheStore,
    private readonly ttls: CatalogCacheTtls = DEFAULT_CATALOG_CACHE_TTLS
  ) {}

  private summaryKey(restaurantId: string): string {
    return `${PREFIX}:summary:${restaurantId}`;
  }

  private menuKey(restaurantId: string): string {
    return `${PREFIX}:menu:${restaurantId}`;
  }

  private listKey(generation: number, discriminator: string): string {
    return `${PREFIX}:list:g${generation}:${discriminator}`;
  }

  private serviceabilityKey(
    generation: number,
    point: ServiceabilityCachePoint,
    subtotal: ServiceabilityCacheSubtotal
  ): string {
    return `${PREFIX}:svc:g${generation}:${point.lat}:${point.lng}:${subtotal.amount}:${subtotal.currency}`;
  }

  /** Current collection generation; absent counter reads as 0 (cold start). */
  async currentGeneration(): Promise<number> {
    return (await this.cache.get<number>(GENERATION_KEY)) ?? 0;
  }

  rememberSummary<T>(restaurantId: string, loader: () => Promise<T>): Promise<T> {
    return this.cache.getOrSet(this.summaryKey(restaurantId), this.ttls.summarySeconds, loader);
  }

  rememberMenu<T>(restaurantId: string, loader: () => Promise<T>): Promise<T> {
    return this.cache.getOrSet(this.menuKey(restaurantId), this.ttls.menuSeconds, loader);
  }

  async rememberList<T>(discriminator: string, loader: () => Promise<T>): Promise<T> {
    const generation = await this.currentGeneration();
    return this.cache.getOrSet(this.listKey(generation, discriminator), this.ttls.listSeconds, loader);
  }

  async remember<T>(
    point: ServiceabilityCachePoint,
    subtotal: ServiceabilityCacheSubtotal,
    loader: () => Promise<T>
  ): Promise<T> {
    const generation = await this.currentGeneration();
    return this.cache.getOrSet(
      this.serviceabilityKey(generation, point, subtotal),
      this.ttls.serviceabilitySeconds,
      loader
    );
  }

  async invalidateRestaurant(restaurantId: string): Promise<void> {
    await this.cache.del(this.summaryKey(restaurantId));
    await this.cache.del(this.menuKey(restaurantId));
    await this.cache.incr(GENERATION_KEY);
  }
}
