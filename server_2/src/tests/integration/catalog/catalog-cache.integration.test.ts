// Catalog caching integration (Phase 13). Exercises the real flow with Mongo
// (mongodb-memory-server via tests/setup.ts) AND Redis (a disposable testcontainer):
// cache hit/miss on the hot read paths, event-driven invalidation through the
// projector, and the no-stale-read guarantee after a write.
import { StartedRedisContainer } from '@testcontainers/redis';
import { randomUUID } from 'crypto';

import { RedisClient } from '../../../infrastructure/redis/client';
import { CacheStore } from '../../../infrastructure/redis/CacheStore';
import { CatalogCache } from '../../../infrastructure/redis/catalog/CatalogCache';
import { startRedisContainer, StartedTestRedis } from '../redis/redis-container';

import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoRestaurantRepository } from '../../../infrastructure/repositories/RestaurantRepository';
import { MongoMenuItemRepository } from '../../../infrastructure/repositories/MenuItemRepository';
import { MongoDeliveryZoneRepository } from '../../../infrastructure/repositories/DeliveryZoneRepository';
import { MongoCatalogReadRepository } from '../../../infrastructure/repositories/CatalogReadRepository';
import { CachedCatalogReadRepository } from '../../../infrastructure/repositories/CachedCatalogReadRepository';
import { CatalogProjectionWriter } from '../../../infrastructure/database/projections/CatalogProjectionWriter';
import { RestaurantModel } from '../../../infrastructure/database/models/RestaurantModel';
import { MenuItemModel } from '../../../infrastructure/database/models/MenuItemModel';
import { RestaurantSummaryModel } from '../../../infrastructure/database/models/RestaurantSummaryModel';
import { RestaurantMenuViewModel } from '../../../infrastructure/database/models/RestaurantMenuViewModel';
import { MenuItemSearchModel } from '../../../infrastructure/database/models/MenuItemSearchModel';
import { InMemoryEventBus } from '../../../application/shared/events/InMemoryEventBus';
import { CatalogProjector } from '../../../application/catalog/handlers/CatalogProjector';
import { registerCatalogProjector } from '../../../application/catalog/handlers/CatalogProjectionRegistry';
import { CheckServiceability } from '../../../application/catalog/use-cases/CheckServiceability';
import { Restaurant } from '../../../domain/catalog/entities/Restaurant';
import { MenuItem } from '../../../domain/catalog/entities/MenuItem';
import { CatalogVisibility } from '../../../domain/catalog/value-objects/CatalogVisibility.vo';
import { CATALOG_VISIBILITY } from '../../../domain/catalog/enums/catalog-visibility.enum';
import { buildRestaurant, buildMenuItem } from './catalog-fixtures';

function uniqueSlug(): string {
  return `r-${randomUUID().slice(0, 8)}`;
}

describe('Catalog caching (Phase 13)', () => {
  let started: StartedTestRedis;
  let container: StartedRedisContainer;
  let redisClient: RedisClient;
  let cache: CatalogCache;

  let txContext: TransactionContext;
  let restaurantRepo: MongoRestaurantRepository;
  let menuItemRepo: MongoMenuItemRepository;
  let deliveryZoneRepo: MongoDeliveryZoneRepository;
  let mongoReadRepo: MongoCatalogReadRepository;
  let cachedReadRepo: CachedCatalogReadRepository;
  let projector: CatalogProjector;
  let bus: InMemoryEventBus;

  beforeAll(async () => {
    started = await startRedisContainer();
    container = started.container;
    redisClient = new RedisClient(started.config);
    await redisClient.connect();
    cache = new CatalogCache(new CacheStore(redisClient));
  });

  afterAll(async () => {
    await redisClient.shutdown();
    await container.stop();
  });

  beforeEach(async () => {
    await redisClient.getClient().flushall();
    txContext = new TransactionContext();
    restaurantRepo = new MongoRestaurantRepository(txContext);
    menuItemRepo = new MongoMenuItemRepository(txContext);
    deliveryZoneRepo = new MongoDeliveryZoneRepository(txContext);
    mongoReadRepo = new MongoCatalogReadRepository();
    cachedReadRepo = new CachedCatalogReadRepository(mongoReadRepo, cache);
    // Projector wired WITH the cache → rebuilds projections then invalidates caches.
    projector = new CatalogProjector(
      restaurantRepo,
      menuItemRepo,
      new CatalogProjectionWriter(),
      cache
    );
    bus = new InMemoryEventBus();
    registerCatalogProjector(bus, projector);
  });

  afterEach(async () => {
    await Promise.all([
      RestaurantModel.deleteMany({}),
      MenuItemModel.deleteMany({}),
      RestaurantSummaryModel.deleteMany({}),
      RestaurantMenuViewModel.deleteMany({}),
      MenuItemSearchModel.deleteMany({}),
    ]);
  });

  interface SeedOpts {
    name?: string;
    withZone?: boolean;
    centerLat?: number;
    centerLng?: number;
  }

  async function seed(opts: SeedOpts = {}): Promise<{ restaurant: Restaurant; item: MenuItem }> {
    const restaurant = buildRestaurant({
      slug: uniqueSlug(),
      name: opts.name,
      withCategory: true,
      withZone: opts.withZone,
      centerLat: opts.centerLat,
      centerLng: opts.centerLng,
    });
    restaurant.publish();
    restaurant.setVisibility(CatalogVisibility.create(CATALOG_VISIBILITY.PUBLIC).getValue());
    await restaurantRepo.save(restaurant);
    await bus.publishAll(restaurant.pullDomainEvents());

    const item = buildMenuItem({
      restaurantId: restaurant.id.toString(),
      categoryId: restaurant.categories[0].id.toString(),
    });
    await menuItemRepo.save(item);
    await bus.publishAll(item.pullDomainEvents());

    return { restaurant, item };
  }

  describe('cache hit / miss', () => {
    it('serves the restaurant summary from cache on the second read (loader runs once)', async () => {
      const { restaurant } = await seed();
      const id = restaurant.id.toString();
      const spy = jest.spyOn(mongoReadRepo, 'getRestaurantSummary');

      const first = await cachedReadRepo.getRestaurantSummary(id);
      const second = await cachedReadRepo.getRestaurantSummary(id);

      expect(first?.slug).toBe(restaurant.slug);
      expect(second).toEqual(first);
      expect(spy).toHaveBeenCalledTimes(1); // second read was a cache hit
    });

    it('serves the menu view from cache on the second read', async () => {
      const { restaurant } = await seed();
      const id = restaurant.id.toString();
      const spy = jest.spyOn(mongoReadRepo, 'getRestaurantMenu');

      await cachedReadRepo.getRestaurantMenu(id);
      await cachedReadRepo.getRestaurantMenu(id);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('serves a browse-list page from cache on the second read', async () => {
      await seed();
      const spy = jest.spyOn(mongoReadRepo, 'listRestaurantSummaries');

      await cachedReadRepo.listRestaurantSummaries({}, { limit: 50 });
      await cachedReadRepo.listRestaurantSummaries({}, { limit: 50 });

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('event-driven invalidation — no stale reads after an update', () => {
    it('returns the updated name after a profile change (summary not stale)', async () => {
      const { restaurant } = await seed({ name: 'Original Name' });
      const id = restaurant.id.toString();

      const before = await cachedReadRepo.getRestaurantSummary(id);
      expect(before?.name).toBe('Original Name');

      // Reload (so the optimistic-lock version is in sync), mutate + persist, then
      // publish the event so the projector rebuilds the projection and invalidates.
      const fresh = (await restaurantRepo.findById(id))!;
      fresh.updateProfile({ name: 'Renamed Bistro' });
      await restaurantRepo.update(fresh);
      await bus.publishAll(fresh.pullDomainEvents());

      const after = await cachedReadRepo.getRestaurantSummary(id);
      expect(after?.name).toBe('Renamed Bistro');
    });

    it('reflects a newly added item in the menu view after invalidation', async () => {
      const { restaurant } = await seed();
      const id = restaurant.id.toString();

      const before = await cachedReadRepo.getRestaurantMenu(id);
      const beforeCount = before!.categories[0].items.length;

      const newItem = buildMenuItem({
        restaurantId: id,
        categoryId: restaurant.categories[0].id.toString(),
        name: 'Masala Dosa',
      });
      await menuItemRepo.save(newItem);
      await bus.publishAll(newItem.pullDomainEvents());

      const after = await cachedReadRepo.getRestaurantMenu(id);
      expect(after!.categories[0].items.length).toBe(beforeCount + 1);
    });

    it('rotates the browse-list cache when a new restaurant is published', async () => {
      await seed();
      const firstPage = await cachedReadRepo.listRestaurantSummaries({}, { limit: 50 });
      expect(firstPage.items).toHaveLength(1);

      // Publishing a second restaurant bumps the cache generation via the projector.
      await seed();

      const secondPage = await cachedReadRepo.listRestaurantSummaries({}, { limit: 50 });
      expect(secondPage.items).toHaveLength(2); // not the stale single-item page
    });
  });

  describe('serviceability caching', () => {
    it('caches the serviceability result then recomputes after invalidation', async () => {
      const { restaurant } = await seed({ withZone: true, centerLat: 19.0, centerLng: 73.0 });
      const useCase = new CheckServiceability(deliveryZoneRepo, cachedReadRepo, cache);
      const query = { lat: 19.0, lng: 73.0, subtotalAmount: 0 };

      const zoneSpy = jest.spyOn(deliveryZoneRepo, 'findZoneContaining');

      const first = await useCase.execute(query);
      const second = await useCase.execute(query);

      expect(first.getValue()).toHaveLength(1);
      expect(second.getValue()).toEqual(first.getValue());
      expect(zoneSpy).toHaveBeenCalledTimes(1); // second was a cache hit

      // A restaurant event bumps the generation → next lookup recomputes.
      const fresh = (await restaurantRepo.findById(restaurant.id.toString()))!;
      fresh.updateProfile({ name: 'Zone Bistro' });
      await restaurantRepo.update(fresh);
      await bus.publishAll(fresh.pullDomainEvents());

      const third = await useCase.execute(query);
      expect(third.getValue()).toHaveLength(1);
      expect(zoneSpy).toHaveBeenCalledTimes(2); // cache miss after invalidation
    });
  });
});
