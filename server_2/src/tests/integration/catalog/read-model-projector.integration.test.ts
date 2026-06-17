import { randomUUID } from 'crypto';
import { Restaurant } from '../../../domain/catalog/entities/Restaurant';
import { MenuItem } from '../../../domain/catalog/entities/MenuItem';
import { ItemAvailability } from '../../../domain/catalog/value-objects/ItemAvailability.vo';
import { CatalogVisibility } from '../../../domain/catalog/value-objects/CatalogVisibility.vo';
import { CATALOG_VISIBILITY } from '../../../domain/catalog/enums/catalog-visibility.enum';
import { RESTAURANT_STATUS } from '../../../domain/catalog/enums/restaurant-status.enum';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoRestaurantRepository } from '../../../infrastructure/repositories/RestaurantRepository';
import { MongoMenuItemRepository } from '../../../infrastructure/repositories/MenuItemRepository';
import { CatalogProjectionWriter } from '../../../infrastructure/database/projections/CatalogProjectionWriter';
import { RestaurantModel } from '../../../infrastructure/database/models/RestaurantModel';
import { MenuItemModel } from '../../../infrastructure/database/models/MenuItemModel';
import { RestaurantSummaryModel } from '../../../infrastructure/database/models/RestaurantSummaryModel';
import { RestaurantMenuViewModel } from '../../../infrastructure/database/models/RestaurantMenuViewModel';
import { MenuItemSearchModel } from '../../../infrastructure/database/models/MenuItemSearchModel';
import { InMemoryEventBus } from '../../../application/shared/events/InMemoryEventBus';
import { CatalogProjector } from '../../../application/catalog/handlers/CatalogProjector';
import { registerCatalogProjector } from '../../../application/catalog/handlers/CatalogProjectionRegistry';
import { buildRestaurant, buildMenuItem } from './catalog-fixtures';

function uniqueSlug(): string {
  return `r-${randomUUID().slice(0, 8)}`;
}

function makeActivePublic(slug: string): Restaurant {
  const r = buildRestaurant({ slug, withCategory: true });
  r.publish();
  r.setVisibility(CatalogVisibility.create(CATALOG_VISIBILITY.PUBLIC).getValue());
  return r;
}

describe('CatalogProjector (read-model projections)', () => {
  let txContext: TransactionContext;
  let restaurantRepo: MongoRestaurantRepository;
  let menuItemRepo: MongoMenuItemRepository;
  let projector: CatalogProjector;
  let bus: InMemoryEventBus;

  beforeEach(() => {
    txContext = new TransactionContext();
    restaurantRepo = new MongoRestaurantRepository(txContext);
    menuItemRepo = new MongoMenuItemRepository(txContext);
    projector = new CatalogProjector(restaurantRepo, menuItemRepo, new CatalogProjectionWriter());
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

  async function persistAndProject(restaurant: Restaurant): Promise<void> {
    await restaurantRepo.save(restaurant);
    await bus.publishAll(restaurant.pullDomainEvents());
  }

  async function persistAndProjectItem(item: MenuItem): Promise<void> {
    await menuItemRepo.save(item);
    await bus.publishAll(item.pullDomainEvents());
  }

  it('builds restaurant_summary and restaurant_menu_view from restaurant events', async () => {
    const restaurant = makeActivePublic(uniqueSlug());
    const id = restaurant.id.toString();
    await persistAndProject(restaurant);

    const summary = await RestaurantSummaryModel.findById(id).lean();
    expect(summary).not.toBeNull();
    expect(summary?.status).toBe(RESTAURANT_STATUS.ACTIVE);
    expect(summary?.visibility).toBe(CATALOG_VISIBILITY.PUBLIC);
    expect(summary?.slug).toBe(restaurant.slug);

    const menuView = await RestaurantMenuViewModel.findById(id).lean();
    expect(menuView).not.toBeNull();
    expect(menuView?.categories).toHaveLength(1);
    expect(menuView?.categories[0].label).toBe('Starters');
    expect(menuView?.categories[0].items).toHaveLength(0);
  });

  it('projects a created menu item into menu_view and menu_item_search', async () => {
    const restaurant = makeActivePublic(uniqueSlug());
    const id = restaurant.id.toString();
    const categoryId = restaurant.categories[0].id.toString();
    await persistAndProject(restaurant);

    const item = buildMenuItem({ restaurantId: id, categoryId });
    await persistAndProjectItem(item);

    const menuView = await RestaurantMenuViewModel.findById(id).lean();
    expect(menuView?.categories[0].items).toHaveLength(1);
    expect(menuView?.categories[0].items[0].name).toBe('Paneer Tikka');

    const search = await MenuItemSearchModel.findById(item.id.toString()).lean();
    expect(search).not.toBeNull();
    expect(search?.restaurantSlug).toBe(restaurant.slug);
    expect(search?.restaurantStatus).toBe(RESTAURANT_STATUS.ACTIVE);
    expect(search?.isAvailable).toBe(true);
  });

  it('re-projects raw availability when an item is toggled', async () => {
    const restaurant = makeActivePublic(uniqueSlug());
    const id = restaurant.id.toString();
    const categoryId = restaurant.categories[0].id.toString();
    await persistAndProject(restaurant);

    const item = buildMenuItem({ restaurantId: id, categoryId });
    await persistAndProjectItem(item);

    // Toggle unavailable (persist + project the availability event).
    item.toggleAvailability(
      ItemAvailability.create({ isAvailable: false, outOfStockReason: 'sold out' }).getValue()
    );
    await menuItemRepo.update(item);
    await bus.publishAll(item.pullDomainEvents());

    const search = await MenuItemSearchModel.findById(item.id.toString()).lean();
    expect(search?.isAvailable).toBe(false);
    const menuView = await RestaurantMenuViewModel.findById(id).lean();
    expect(menuView?.categories[0].items[0].isAvailable).toBe(false);
  });

  it('drops removed items from menu_item_search on rebuild', async () => {
    const restaurant = makeActivePublic(uniqueSlug());
    const id = restaurant.id.toString();
    const categoryId = restaurant.categories[0].id.toString();
    await persistAndProject(restaurant);

    const item = buildMenuItem({ restaurantId: id, categoryId });
    await persistAndProjectItem(item);
    expect(await MenuItemSearchModel.countDocuments({ restaurantId: id })).toBe(1);

    // Soft-delete the item, then trigger a rebuild (any restaurant event).
    item.softDelete();
    await menuItemRepo.update(item);
    await projector.rebuild(id);

    expect(await MenuItemSearchModel.countDocuments({ restaurantId: id })).toBe(0);
    const menuView = await RestaurantMenuViewModel.findById(id).lean();
    expect(menuView?.categories[0].items).toHaveLength(0);
  });

  it('tombstones projections when the restaurant is soft-deleted', async () => {
    const restaurant = makeActivePublic(uniqueSlug());
    const id = restaurant.id.toString();
    await persistAndProject(restaurant);

    // Reload so the optimistic-lock guard sees the persisted version.
    const loaded = (await restaurantRepo.findById(id)) as Restaurant;
    loaded.softDelete();
    await restaurantRepo.update(loaded);
    await projector.rebuild(id);

    const summary = await RestaurantSummaryModel.findById(id).lean();
    expect(summary?.deletedAt).not.toBeNull();
    const menuView = await RestaurantMenuViewModel.findById(id).lean();
    expect(menuView?.deletedAt).not.toBeNull();
  });
});
