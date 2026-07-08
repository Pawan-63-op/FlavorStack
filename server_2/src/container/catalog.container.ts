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
  const readRepository: ICatalogReadRepository = cache
    ? new CachedCatalogReadRepository(mongoReadRepository, cache)
    : mongoReadRepository;
  const projectionWriter = new CatalogProjectionWriter();
  const openingHoursService = new MongoOpeningHoursService();
  const searchService = new MongoSearchService();

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
