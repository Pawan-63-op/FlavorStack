// Composition root for the Catalog read-side (Phase 9; caching added in Phase 13) —
// binds the read-model projection writer, the projection-driven read repository, the
// opening-hours service, the query use-cases, and the in-process read-model projector.
//
// Write-side command use-cases (Phase 7/8) own their own transaction boundary and
// are wired elsewhere; here we assemble the read path and subscribe the projector
// so committed writes keep the projections in sync.
//
// When a `CatalogCache` is supplied (Phase 13) the read repository is wrapped with a
// cache-aside decorator, serviceability reads go read-through, and the projector is
// given the cache as its invalidator — so committed writes also evict stale caches.
import { IEventBus } from '../application/shared/events/IEventBus';
import { TransactionContext } from '../infrastructure/database/TransactionContext';
import { ICatalogReadRepository } from '../domain/catalog/repositories/ICatalogReadRepository';

import { MongoRestaurantRepository } from '../infrastructure/repositories/RestaurantRepository';
import { MongoMenuItemRepository } from '../infrastructure/repositories/MenuItemRepository';
import { MongoDeliveryZoneRepository } from '../infrastructure/repositories/DeliveryZoneRepository';
import { MongoCatalogReadRepository } from '../infrastructure/repositories/CatalogReadRepository';
import { CachedCatalogReadRepository } from '../infrastructure/repositories/CachedCatalogReadRepository';
import { CatalogProjectionWriter } from '../infrastructure/database/projections/CatalogProjectionWriter';
import { MongoOpeningHoursService } from '../infrastructure/services/OpeningHoursService';
import { MongoSearchService } from '../infrastructure/search/MongoSearchService';
import { CatalogCache } from '../infrastructure/redis/catalog/CatalogCache';

import { CatalogProjector } from '../application/catalog/handlers/CatalogProjector';
import { registerCatalogProjector } from '../application/catalog/handlers/CatalogProjectionRegistry';
import { GetRestaurant } from '../application/catalog/use-cases/GetRestaurant';
import { ListRestaurants } from '../application/catalog/use-cases/ListRestaurants';
import { GetRestaurantMenu } from '../application/catalog/use-cases/GetRestaurantMenu';
import { GetMenuItem } from '../application/catalog/use-cases/GetMenuItem';
import { GetItemsSnapshot } from '../application/catalog/use-cases/GetItemsSnapshot';
import { CheckServiceability } from '../application/catalog/use-cases/CheckServiceability';
import { SearchRestaurants } from '../application/catalog/use-cases/SearchRestaurants';
import { SearchMenuItems } from '../application/catalog/use-cases/SearchMenuItems';
import { GetNearbyRestaurants } from '../application/catalog/use-cases/GetNearbyRestaurants';

export interface CatalogReadContainer {
  readRepository: ICatalogReadRepository;
  openingHoursService: MongoOpeningHoursService;
  searchService: MongoSearchService;
  projector: CatalogProjector;
  queries: {
    getRestaurant: GetRestaurant;
    listRestaurants: ListRestaurants;
    getRestaurantMenu: GetRestaurantMenu;
    getMenuItem: GetMenuItem;
    getItemsSnapshot: GetItemsSnapshot;
    checkServiceability: CheckServiceability;
    searchRestaurants: SearchRestaurants;
    searchMenuItems: SearchMenuItems;
    getNearbyRestaurants: GetNearbyRestaurants;
  };
}

export function createCatalogReadContainer(
  eventBus: IEventBus,
  txContext: TransactionContext,
  cache?: CatalogCache
): CatalogReadContainer {
  const restaurantRepo = new MongoRestaurantRepository(txContext);
  const menuItemRepo = new MongoMenuItemRepository(txContext);
  const deliveryZoneRepo = new MongoDeliveryZoneRepository(txContext);

  const mongoReadRepository = new MongoCatalogReadRepository();
  // Phase 13: transparent cache-aside decorator when a cache is wired.
  const readRepository: ICatalogReadRepository = cache
    ? new CachedCatalogReadRepository(mongoReadRepository, cache)
    : mongoReadRepository;
  const projectionWriter = new CatalogProjectionWriter();
  const openingHoursService = new MongoOpeningHoursService();
  const searchService = new MongoSearchService();

  // The projector reads/writes through the inner Mongo repos; it only needs the
  // cache as an invalidator (evict-after-commit), so pass `cache` directly.
  const projector = new CatalogProjector(restaurantRepo, menuItemRepo, projectionWriter, cache);
  registerCatalogProjector(eventBus, projector);

  return {
    readRepository,
    openingHoursService,
    searchService,
    projector,
    queries: {
      getRestaurant: new GetRestaurant(readRepository),
      listRestaurants: new ListRestaurants(readRepository),
      getRestaurantMenu: new GetRestaurantMenu(readRepository),
      getMenuItem: new GetMenuItem(readRepository),
      getItemsSnapshot: new GetItemsSnapshot(readRepository),
      checkServiceability: new CheckServiceability(deliveryZoneRepo, readRepository, cache),
      searchRestaurants: new SearchRestaurants(searchService),
      searchMenuItems: new SearchMenuItems(searchService),
      getNearbyRestaurants: new GetNearbyRestaurants(searchService),
    },
  };
}
