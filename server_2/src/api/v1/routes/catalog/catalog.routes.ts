import { Router, raw } from 'express';
import { RestaurantController } from '../../controllers/catalog/RestaurantController';
import { MenuController } from '../../controllers/catalog/MenuController';
import { DiscoveryController } from '../../controllers/catalog/DiscoveryController';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimiter';
import { validate } from '../../middleware/validate';
import { ITokenService } from '../../../../domain/identity/services/ITokenService';
import { RateLimiter } from '../../../../infrastructure/redis/RateLimiter';
import {
  restaurantIdParam,
  categoryIdParam,
  createRestaurantSchema,
  updateRestaurantSchema,
  setVisibilitySchema,
  setOpeningHoursSchema,
  addCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema,
  manageZoneSchema,
  mineRestaurantsQuery,
} from '../../validators/catalog/restaurant.catalog.validator';
import {
  itemIdParam,
  addMenuItemSchema,
  updateMenuItemSchema,
  toggleAvailabilitySchema,
  setItemVariantsSchema,
} from '../../validators/catalog/menu.catalog.validator';
import {
  listRestaurantsQuery,
  searchRestaurantsQuery,
  searchMenuItemsQuery,
  nearbyQuery,
  serviceabilityQuery,
  deliverableQuery,
  itemsSnapshotQuery,
} from '../../validators/catalog/discovery.catalog.validator';

const IMAGE_LIMIT = '5mb';

export interface CatalogRoutesDeps {
  restaurantController: RestaurantController;
  menuController: MenuController;
  discoveryController: DiscoveryController;
  tokenService: ITokenService;
  rateLimiter: RateLimiter;
}

export function createCatalogRoutes(deps: CatalogRoutesDeps): Router {
  const router = Router();
  const r = deps.restaurantController;
  const m = deps.menuController;
  const d = deps.discoveryController;
  const auth = authenticate(deps.tokenService);
  const search = rateLimit(deps.rateLimiter, 'catalog-search');
  const rawImage = raw({ type: '*/*', limit: IMAGE_LIMIT });

  router.get('/restaurants/mine', auth, validate(mineRestaurantsQuery, 'query'), r.mine);

  router.get('/restaurants', validate(listRestaurantsQuery, 'query'), d.list);
  router.get('/search/restaurants', search, validate(searchRestaurantsQuery, 'query'), d.searchRestaurants);
  router.get('/search/items', search, validate(searchMenuItemsQuery, 'query'), d.searchItems);
  router.get('/nearby', search, validate(nearbyQuery, 'query'), d.nearby);
  router.get('/serviceability', search, validate(serviceabilityQuery, 'query'), d.serviceability);
  router.get('/deliverable', search, validate(deliverableQuery, 'query'), d.deliverable);
  router.get('/items/snapshot', validate(itemsSnapshotQuery, 'query'), d.itemsSnapshot);
  router.get('/items/:id', validate(itemIdParam, 'params'), d.getItem);
  router.get('/restaurants/:id', validate(restaurantIdParam, 'params'), d.getOne);
  router.get('/restaurants/:id/menu', validate(restaurantIdParam, 'params'), d.getMenu);

  router.post('/restaurants', auth, validate(createRestaurantSchema), r.create);
  router.patch('/restaurants/:id', auth, validate(restaurantIdParam, 'params'), validate(updateRestaurantSchema), r.update);
  router.delete('/restaurants/:id', auth, validate(restaurantIdParam, 'params'), r.remove);
  router.post('/restaurants/:id/publish', auth, validate(restaurantIdParam, 'params'), r.publish);
  router.post('/restaurants/:id/pause', auth, validate(restaurantIdParam, 'params'), r.pause);
  router.post('/restaurants/:id/close', auth, validate(restaurantIdParam, 'params'), r.close);
  router.patch('/restaurants/:id/visibility', auth, validate(restaurantIdParam, 'params'), validate(setVisibilitySchema), r.setVisibility);
  router.put('/restaurants/:id/opening-hours', auth, validate(restaurantIdParam, 'params'), validate(setOpeningHoursSchema), r.setOpeningHours);
  router.post('/restaurants/:id/image', auth, validate(restaurantIdParam, 'params'), rawImage, r.uploadImage);

  router.post('/restaurants/:id/categories', auth, validate(restaurantIdParam, 'params'), validate(addCategorySchema), r.addCategory);
  router.post('/restaurants/:id/categories/reorder', auth, validate(restaurantIdParam, 'params'), validate(reorderCategoriesSchema), r.reorderCategories);
  router.patch('/restaurants/:id/categories/:categoryId', auth, validate(categoryIdParam, 'params'), validate(updateCategorySchema), r.updateCategory);
  router.delete('/restaurants/:id/categories/:categoryId', auth, validate(categoryIdParam, 'params'), r.removeCategory);

  router.post('/restaurants/:id/zones', auth, validate(restaurantIdParam, 'params'), validate(manageZoneSchema), r.manageZone);

  router.post('/restaurants/:id/items', auth, validate(restaurantIdParam, 'params'), validate(addMenuItemSchema), m.addItem);
  router.patch('/items/:id', auth, validate(itemIdParam, 'params'), validate(updateMenuItemSchema), m.updateItem);
  router.delete('/items/:id', auth, validate(itemIdParam, 'params'), m.removeItem);
  router.patch('/items/:id/availability', auth, validate(itemIdParam, 'params'), validate(toggleAvailabilitySchema), m.toggleAvailability);
  router.put('/items/:id/variants', auth, validate(itemIdParam, 'params'), validate(setItemVariantsSchema), m.setVariants);
  router.post('/items/:id/image', auth, validate(itemIdParam, 'params'), rawImage, m.uploadImage);

  return router;
}
