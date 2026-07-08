import { randomUUID } from 'crypto';
import { Restaurant } from '../../../domain/catalog/entities/Restaurant';
import { MenuItem } from '../../../domain/catalog/entities/MenuItem';
import { ItemAvailability } from '../../../domain/catalog/value-objects/ItemAvailability.vo';
import { CatalogVisibility } from '../../../domain/catalog/value-objects/CatalogVisibility.vo';
import { CATALOG_VISIBILITY } from '../../../domain/catalog/enums/catalog-visibility.enum';
import { RESTAURANT_STATUS } from '../../../domain/catalog/enums/restaurant-status.enum';
import { Money } from '../../../domain/shared/Money';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoRestaurantRepository } from '../../../infrastructure/repositories/RestaurantRepository';
import { MongoMenuItemRepository } from '../../../infrastructure/repositories/MenuItemRepository';
import { CommerceCatalogReadRepository } from '../../../infrastructure/repositories/CommerceCatalogReadRepository';
import { CommerceCatalogViewModel } from '../../../infrastructure/database/models/CommerceCatalogViewModel';
import { CommerceCatalogProjectionCheckpointModel } from '../../../infrastructure/database/models/CommerceCatalogProjectionCheckpointModel';
import { RestaurantModel } from '../../../infrastructure/database/models/RestaurantModel';
import { MenuItemModel } from '../../../infrastructure/database/models/MenuItemModel';
import { InMemoryEventBus } from '../../../application/shared/events/InMemoryEventBus';
import { CommerceCatalogProjector } from '../../../application/commerce/handlers/CommerceCatalogProjector';
import { registerCommerceCatalogProjector } from '../../../application/commerce/handlers/CommerceProjectionRegistry';
import { RestaurantUpdated } from '../../../domain/catalog/events/RestaurantUpdated';
import { buildRestaurant, buildMenuItem } from '../catalog/catalog-fixtures';

function uniqueSlug(): string {
  return `r-${randomUUID().slice(0, 8)}`;
}

function makeActivePublic(slug: string): Restaurant {
  const r = buildRestaurant({ slug, withCategory: true, withZone: true, withOpeningHours: true });
  r.publish();
  r.setVisibility(CatalogVisibility.create(CATALOG_VISIBILITY.PUBLIC).getValue());
  return r;
}

describe('CommerceCatalogProjector (commerce_catalog_view projections)', () => {
  let txContext: TransactionContext;
  let restaurantRepo: MongoRestaurantRepository;
  let menuItemRepo: MongoMenuItemRepository;
  let projectionRepo: CommerceCatalogReadRepository;
  let projector: CommerceCatalogProjector;
  let bus: InMemoryEventBus;

  beforeEach(() => {
    txContext = new TransactionContext();
    restaurantRepo = new MongoRestaurantRepository(txContext);
    menuItemRepo = new MongoMenuItemRepository(txContext);
    projectionRepo = new CommerceCatalogReadRepository();
    projector = new CommerceCatalogProjector(restaurantRepo, menuItemRepo, projectionRepo);
    bus = new InMemoryEventBus();
    registerCommerceCatalogProjector(bus, projector);
  });

  afterEach(async () => {
    await Promise.all([
      RestaurantModel.deleteMany({}),
      MenuItemModel.deleteMany({}),
      CommerceCatalogViewModel.deleteMany({}),
      CommerceCatalogProjectionCheckpointModel.deleteMany({}),
    ]);
  });

  async function persistAndProjectRestaurant(restaurant: Restaurant): Promise<void> {
    await restaurantRepo.save(restaurant);
    await bus.publishAll(restaurant.pullDomainEvents());
  }

  async function persistAndProjectItem(item: MenuItem): Promise<void> {
    await menuItemRepo.update(item);
    await bus.publishAll(item.pullDomainEvents());
  }

  it('builds commerce_catalog_view from restaurant + menu item events', async () => {
    const restaurant = makeActivePublic(uniqueSlug());
    const id = restaurant.id.toString();
    const categoryId = restaurant.categories[0].id.toString();

    const item = buildMenuItem({ restaurantId: id, categoryId, withVariants: true });
    await menuItemRepo.save(item);

    await persistAndProjectRestaurant(restaurant);

    const view = await CommerceCatalogViewModel.findById(id).lean();
    expect(view).not.toBeNull();
    expect(view?.name).toBe(restaurant.name);
    expect(view?.slug).toBe(restaurant.slug);
    expect(view?.status).toBe(RESTAURANT_STATUS.ACTIVE);
    expect(view?.visibility).toBe(CATALOG_VISIBILITY.PUBLIC);
    expect(view?.openingHours).not.toBeNull();
    expect(view?.deliveryZones).toHaveLength(1);

    expect(view?.items).toHaveLength(1);
    const itemView = view?.items[0];
    expect(itemView?.menuItemId).toBe(item.id.toString());
    expect(itemView?.name).toBe(item.name);
    expect(itemView?.basePriceAmount).toBe(item.basePrice.amount);
    expect(itemView?.variantGroups).toHaveLength(1);
    expect(itemView?.variantGroups[0].options).toHaveLength(2);
  });

  it('refreshes the projected item on MenuItemAvailabilityChanged', async () => {
    const restaurant = makeActivePublic(uniqueSlug());
    const id = restaurant.id.toString();
    const categoryId = restaurant.categories[0].id.toString();

    const item = buildMenuItem({ restaurantId: id, categoryId });
    await menuItemRepo.save(item);
    await persistAndProjectRestaurant(restaurant);

    item.toggleAvailability(
      ItemAvailability.create({ isAvailable: false, outOfStockReason: 'sold out' }).getValue()
    );
    await persistAndProjectItem(item);

    const view = await CommerceCatalogViewModel.findById(id).lean();
    expect(view?.items[0].isAvailable).toBe(false);
    expect(view?.items[0].outOfStockReason).toBe('sold out');
  });

  it('refreshes the projected item on MenuItemUpdated (price change)', async () => {
    const restaurant = makeActivePublic(uniqueSlug());
    const id = restaurant.id.toString();
    const categoryId = restaurant.categories[0].id.toString();

    const item = buildMenuItem({ restaurantId: id, categoryId, price: 25000 });
    await menuItemRepo.save(item);
    await persistAndProjectRestaurant(restaurant);

    item.changePrice(Money.create(30000).getValue());
    await persistAndProjectItem(item);

    const view = await CommerceCatalogViewModel.findById(id).lean();
    expect(view?.items[0].basePriceAmount).toBe(30000);
  });

  it('is idempotent: replaying the same eventId is a no-op', async () => {
    const restaurant = makeActivePublic(uniqueSlug());

    await restaurantRepo.save(restaurant);
    const events = restaurant.pullDomainEvents();
    const restaurantUpdatedEvent = events.find((e) => e.eventName === 'RestaurantUpdated');
    expect(restaurantUpdatedEvent).toBeDefined();

    const findByIdSpy = jest.spyOn(restaurantRepo, 'findById');

    await bus.publish(restaurantUpdatedEvent!);
    expect(await CommerceCatalogProjectionCheckpointModel.countDocuments({ _id: restaurantUpdatedEvent!.eventId })).toBe(1);
    const callsAfterFirst = findByIdSpy.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    await bus.publish(restaurantUpdatedEvent!);
    expect(await CommerceCatalogProjectionCheckpointModel.countDocuments({ _id: restaurantUpdatedEvent!.eventId })).toBe(1);
    expect(findByIdSpy.mock.calls.length).toBe(callsAfterFirst);

    findByIdSpy.mockRestore();
  });

  it('tombstones the projection when the restaurant is soft-deleted', async () => {
    const restaurant = makeActivePublic(uniqueSlug());
    const id = restaurant.id.toString();
    await persistAndProjectRestaurant(restaurant);

    expect(await CommerceCatalogViewModel.findById(id).lean()).not.toBeNull();

    await restaurantRepo.softDelete(id);
    await projector.rebuild(id, new RestaurantUpdated(id, ['deletedAt']));

    expect(await CommerceCatalogViewModel.findById(id).lean()).toBeNull();
  });
});
