import { randomUUID } from 'crypto';
import { Restaurant } from '../../../domain/catalog/entities/Restaurant';
import { MenuItem } from '../../../domain/catalog/entities/MenuItem';
import { OpeningHours, WeeklySchedule } from '../../../domain/catalog/value-objects/OpeningHours.vo';
import { CatalogVisibility } from '../../../domain/catalog/value-objects/CatalogVisibility.vo';
import { CATALOG_VISIBILITY } from '../../../domain/catalog/enums/catalog-visibility.enum';
import { WEEKDAY } from '../../../domain/catalog/enums/weekday.enum';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoRestaurantRepository } from '../../../infrastructure/repositories/RestaurantRepository';
import { MongoMenuItemRepository } from '../../../infrastructure/repositories/MenuItemRepository';
import { MongoDeliveryZoneRepository } from '../../../infrastructure/repositories/DeliveryZoneRepository';
import { MongoCatalogReadRepository } from '../../../infrastructure/repositories/CatalogReadRepository';
import { MongoCatalogQueryRepository } from '../../../infrastructure/repositories/CatalogQueryRepository';
import { CatalogProjectionWriter } from '../../../infrastructure/database/projections/CatalogProjectionWriter';
import { RestaurantModel } from '../../../infrastructure/database/models/RestaurantModel';
import { MenuItemModel } from '../../../infrastructure/database/models/MenuItemModel';
import { RestaurantSummaryModel } from '../../../infrastructure/database/models/RestaurantSummaryModel';
import { MenuItemSearchModel } from '../../../infrastructure/database/models/MenuItemSearchModel';
import { InMemoryEventBus } from '../../../application/shared/events/InMemoryEventBus';
import { CatalogProjector } from '../../../application/catalog/handlers/CatalogProjector';
import { registerCatalogProjector } from '../../../application/catalog/handlers/CatalogProjectionRegistry';
import { GetRestaurant } from '../../../application/catalog/use-cases/GetRestaurant';
import { ListRestaurants } from '../../../application/catalog/use-cases/ListRestaurants';
import { GetRestaurantMenu } from '../../../application/catalog/use-cases/GetRestaurantMenu';
import { GetMenuItem } from '../../../application/catalog/use-cases/GetMenuItem';
import { GetItemsSnapshot } from '../../../application/catalog/use-cases/GetItemsSnapshot';
import { CheckServiceability } from '../../../application/catalog/use-cases/CheckServiceability';
import { ListDeliverableRestaurants } from '../../../application/catalog/use-cases/ListDeliverableRestaurants';
import { buildRestaurant, buildMenuItem } from './catalog-fixtures';

function uniqueSlug(): string {
  return `r-${randomUUID().slice(0, 8)}`;
}

function closedHours(): OpeningHours {
  const schedule = {
    [WEEKDAY.MONDAY]: [],
    [WEEKDAY.TUESDAY]: [],
    [WEEKDAY.WEDNESDAY]: [],
    [WEEKDAY.THURSDAY]: [],
    [WEEKDAY.FRIDAY]: [],
    [WEEKDAY.SATURDAY]: [],
    [WEEKDAY.SUNDAY]: [],
  } as WeeklySchedule;
  return OpeningHours.create({ schedule, holidays: [] }).getValue();
}

describe('Catalog query use-cases (projection-driven)', () => {
  let txContext: TransactionContext;
  let restaurantRepo: MongoRestaurantRepository;
  let menuItemRepo: MongoMenuItemRepository;
  let deliveryZoneRepo: MongoDeliveryZoneRepository;
  let readRepo: MongoCatalogReadRepository;
  let queryRepo: MongoCatalogQueryRepository;
  let projector: CatalogProjector;
  let bus: InMemoryEventBus;

  beforeEach(() => {
    txContext = new TransactionContext();
    restaurantRepo = new MongoRestaurantRepository(txContext);
    menuItemRepo = new MongoMenuItemRepository(txContext);
    deliveryZoneRepo = new MongoDeliveryZoneRepository(txContext);
    queryRepo = new MongoCatalogQueryRepository();
    readRepo = new MongoCatalogReadRepository(queryRepo);
    projector = new CatalogProjector(restaurantRepo, menuItemRepo, new CatalogProjectionWriter());
    bus = new InMemoryEventBus();
    registerCatalogProjector(bus, projector);
  });

  afterEach(async () => {
    await Promise.all([
      RestaurantModel.deleteMany({}),
      MenuItemModel.deleteMany({}),
      RestaurantSummaryModel.deleteMany({}),
      MenuItemSearchModel.deleteMany({}),
    ]);
  });

  interface SeedOpts {
    slug?: string;
    publish?: boolean;
    visibility?: string;
    pause?: boolean;
    closed?: boolean;
    withZone?: boolean;
    centerLat?: number;
    centerLng?: number;
    withVariants?: boolean;
  }

  async function seed(opts: SeedOpts = {}): Promise<{ restaurant: Restaurant; item: MenuItem }> {
    const restaurant = buildRestaurant({
      slug: opts.slug ?? uniqueSlug(),
      withCategory: true,
      withZone: opts.withZone,
      centerLat: opts.centerLat,
      centerLng: opts.centerLng,
    });
    if (opts.closed) restaurant.setOpeningHours(closedHours());
    if (opts.publish ?? true) restaurant.publish();
    if (opts.pause) restaurant.pause();
    const visibility = opts.visibility ?? CATALOG_VISIBILITY.PUBLIC;
    restaurant.setVisibility(CatalogVisibility.create(visibility as 'PUBLIC').getValue());

    await restaurantRepo.save(restaurant);
    await bus.publishAll(restaurant.pullDomainEvents());

    const item = buildMenuItem({
      restaurantId: restaurant.id.toString(),
      categoryId: restaurant.categories[0].id.toString(),
      withVariants: opts.withVariants,
    });
    await menuItemRepo.save(item);
    await bus.publishAll(item.pullDomainEvents());

    return { restaurant, item };
  }

  describe('GetRestaurant', () => {
    it('returns the summary for a public/active restaurant', async () => {
      const { restaurant } = await seed();
      const result = await new GetRestaurant(readRepo).execute({ restaurantId: restaurant.id.toString() });
      expect(result.isSuccess).toBe(true);
      expect(result.getValue().slug).toBe(restaurant.slug);
      expect(result.getValue().isOpen).toBe(true);
    });

    it('returns NotFound for a hidden restaurant', async () => {
      const { restaurant } = await seed({ visibility: CATALOG_VISIBILITY.HIDDEN });
      const result = await new GetRestaurant(readRepo).execute({ restaurantId: restaurant.id.toString() });
      expect(result.isFailure).toBe(true);
    });
  });

  describe('ListRestaurants', () => {
    it('lists public/active restaurants and excludes hidden + paused', async () => {
      const visible = await seed();
      await seed({ visibility: CATALOG_VISIBILITY.HIDDEN });
      await seed({ pause: true });

      const result = await new ListRestaurants(readRepo, deliveryZoneRepo, queryRepo).execute({ limit: 50 });
      const ids = result.getValue().items.map((r) => r.id);
      expect(ids).toContain(visible.restaurant.id.toString());
      expect(result.getValue().items).toHaveLength(1);
    });

    it('filters by isOpen=false (derived) for a closed restaurant', async () => {
      await seed({ closed: true });
      const open = await new ListRestaurants(readRepo, deliveryZoneRepo, queryRepo).execute({ isOpen: true, limit: 50 });
      expect(open.getValue().items).toHaveLength(0);
      const closed = await new ListRestaurants(readRepo, deliveryZoneRepo, queryRepo).execute({ isOpen: false, limit: 50 });
      expect(closed.getValue().items).toHaveLength(1);
    });
  });

  describe('GetRestaurantMenu', () => {
    it('returns the full menu tree with available items when open', async () => {
      const { restaurant } = await seed();
      const result = await new GetRestaurantMenu(readRepo).execute({ restaurantId: restaurant.id.toString() });
      expect(result.isSuccess).toBe(true);
      const menu = result.getValue();
      expect(menu.categories[0].items[0].isAvailable).toBe(true);
    });

    it('derives item availability to false when the restaurant is closed', async () => {
      const { restaurant } = await seed({ closed: true });
      const result = await new GetRestaurantMenu(readRepo).execute({ restaurantId: restaurant.id.toString() });
      const menu = result.getValue();
      expect(menu.restaurant.isOpen).toBe(false);
      expect(menu.categories[0].items[0].isAvailable).toBe(false);
    });
  });

  describe('GetMenuItem', () => {
    it('returns the item view for a public restaurant', async () => {
      const { item } = await seed();
      const result = await new GetMenuItem(readRepo).execute({ itemId: item.id.toString() });
      expect(result.isSuccess).toBe(true);
      expect(result.getValue().name).toBe('Paneer Tikka');
    });

    it('returns NotFound when the restaurant is hidden', async () => {
      const { item } = await seed({ visibility: CATALOG_VISIBILITY.HIDDEN });
      const result = await new GetMenuItem(readRepo).execute({ itemId: item.id.toString() });
      expect(result.isFailure).toBe(true);
    });
  });

  /**
   * Phase 10-4.3. The picker needs two things the customer API did not expose:
   * `hasVariants` on the list views (so the menu knows to open a dialog) and the
   * groups themselves on the single-item read. Variant groups are NOT projected into
   * `menu_item_search`, so the detail read pulls them from the source of truth.
   */
  describe('variant exposure (customer picker)', () => {
    it('returns variantGroups with option ids and price deltas on the item detail read', async () => {
      const { item } = await seed({ withVariants: true });

      const result = await new GetMenuItem(readRepo).execute({ itemId: item.id.toString() });

      expect(result.isSuccess).toBe(true);
      const detail = result.getValue();
      expect(detail.hasVariants).toBe(true);
      expect(detail.variantGroups).toHaveLength(1);

      const group = detail.variantGroups[0];
      expect(group.label).toBe('Size');
      expect(group.selectionType).toBe('SINGLE');
      expect(group.required).toBe(true);
      expect(group.minSelect).toBe(1);
      expect(group.maxSelect).toBe(1);
      expect(group.options.map((o) => [o.label, o.priceDeltaAmount, o.isDefault])).toEqual([
        ['Half', 0, true],
        ['Full', 10000, false],
      ]);
      // The ids are what the client posts as `selectedOptionIds`, so they must be real.
      expect(group.options.every((o) => o.id.length > 0)).toBe(true);
    });

    it('returns an empty variantGroups list for an item without variants', async () => {
      const { item } = await seed();
      const result = await new GetMenuItem(readRepo).execute({ itemId: item.id.toString() });
      expect(result.getValue().hasVariants).toBe(false);
      expect(result.getValue().variantGroups).toEqual([]);
    });

    it('flags hasVariants on the restaurant menu list so the picker can be offered', async () => {
      const { restaurant } = await seed({ withVariants: true });
      const menu = await new GetRestaurantMenu(readRepo).execute({
        restaurantId: restaurant.id.toString(),
      });
      expect(menu.getValue().categories[0].items[0].hasVariants).toBe(true);
    });

    it('projects hasVariants onto menu_item_search so search results agree', async () => {
      const { item } = await seed({ withVariants: true });
      const doc = await MenuItemSearchModel.findOne({ _id: item.id.toString() }).lean();
      expect(doc?.hasVariants).toBe(true);
    });
  });

  describe('GetItemsSnapshot', () => {
    it('returns raw item price/availability regardless of restaurant open-state', async () => {
      const { item } = await seed({ closed: true });
      const result = await new GetItemsSnapshot(readRepo).execute({ itemIds: [item.id.toString()] });
      expect(result.getValue()).toHaveLength(1);
      expect(result.getValue()[0].isAvailable).toBe(true);
      expect(result.getValue()[0].basePriceAmount).toBe(25000);
    });
  });

  describe('CheckServiceability', () => {
    it('returns the restaurant + resolved fee for a point inside its delivery zone', async () => {
      const { restaurant } = await seed({ withZone: true, centerLat: 19.0, centerLng: 73.0 });

      const result = await new CheckServiceability(deliveryZoneRepo, queryRepo).execute({
        lat: 19.0,
        lng: 73.0,
        subtotalAmount: 0,
      });
      expect(result.isSuccess).toBe(true);
      const serviceable = result.getValue();
      expect(serviceable).toHaveLength(1);
      expect(serviceable[0].restaurantId).toBe(restaurant.id.toString());
      expect(serviceable[0].deliveryFee.amount).toBe(2000);
      expect(serviceable[0].minOrder.amount).toBe(10000);
    });

    it('returns empty for a point outside any delivery zone', async () => {
      await seed({ withZone: true, centerLat: 19.0, centerLng: 73.0 });
      const result = await new CheckServiceability(deliveryZoneRepo, queryRepo).execute({
        lat: 1.0,
        lng: 1.0,
      });
      expect(result.getValue()).toHaveLength(0);
    });

    // The publish gate used to be enforced implicitly by the `restaurant_summary` read
    // returning null. Now that the point is resolved straight from `restaurants`, these
    // pin the {visibility: PUBLIC, status: ACTIVE, deletedAt: null} filter in place.
    it('excludes a zone whose restaurant is not PUBLIC', async () => {
      await seed({
        withZone: true,
        centerLat: 19.0,
        centerLng: 73.0,
        visibility: CATALOG_VISIBILITY.HIDDEN,
      });
      const result = await new CheckServiceability(deliveryZoneRepo, queryRepo).execute({
        lat: 19.0,
        lng: 73.0,
      });
      expect(result.getValue()).toHaveLength(0);
    });

    it('excludes a zone whose restaurant is unpublished (DRAFT)', async () => {
      await seed({ withZone: true, centerLat: 19.0, centerLng: 73.0, publish: false });
      const result = await new CheckServiceability(deliveryZoneRepo, queryRepo).execute({
        lat: 19.0,
        lng: 73.0,
      });
      expect(result.getValue()).toHaveLength(0);
    });

    it('excludes a zone whose restaurant is paused (INACTIVE)', async () => {
      await seed({ withZone: true, centerLat: 19.0, centerLng: 73.0, pause: true });
      const result = await new CheckServiceability(deliveryZoneRepo, queryRepo).execute({
        lat: 19.0,
        lng: 73.0,
      });
      expect(result.getValue()).toHaveLength(0);
    });

    it('waives the fee when subtotal meets the free-delivery threshold', async () => {
      await seed({ withZone: true, centerLat: 19.0, centerLng: 73.0 });
      const result = await new CheckServiceability(deliveryZoneRepo, queryRepo).execute({
        lat: 19.0,
        lng: 73.0,
        subtotalAmount: 60000, // ≥ freeAboveSubtotal (50000)
      });
      expect(result.getValue()[0].deliveryFee.amount).toBe(0);
    });
  });

  /**
   * The reachability half, split out in Phase 10.4.1. These mirror the publish-gate cases
   * above one-for-one: `/catalog/deliverable` and `/catalog/serviceability` share
   * `findServiceableZones`, so an exclusion that holds for one must hold for the other.
   */
  describe('ListDeliverableRestaurants', () => {
    const deliverable = () => new ListDeliverableRestaurants(deliveryZoneRepo, queryRepo);

    it('returns the restaurant id for a point inside its delivery zone', async () => {
      const { restaurant } = await seed({ withZone: true, centerLat: 19.0, centerLng: 73.0 });
      const result = await deliverable().execute({ lat: 19.0, lng: 73.0 });
      expect(result.isSuccess).toBe(true);
      expect(result.getValue().restaurantIds).toEqual([restaurant.id.toString()]);
    });

    it('returns empty for a point outside any delivery zone', async () => {
      await seed({ withZone: true, centerLat: 19.0, centerLng: 73.0 });
      const result = await deliverable().execute({ lat: 1.0, lng: 1.0 });
      expect(result.getValue().restaurantIds).toEqual([]);
    });

    it('excludes a zone whose restaurant is not PUBLIC', async () => {
      await seed({
        withZone: true,
        centerLat: 19.0,
        centerLng: 73.0,
        visibility: CATALOG_VISIBILITY.HIDDEN,
      });
      const result = await deliverable().execute({ lat: 19.0, lng: 73.0 });
      expect(result.getValue().restaurantIds).toEqual([]);
    });

    it('excludes a zone whose restaurant is unpublished (DRAFT)', async () => {
      await seed({ withZone: true, centerLat: 19.0, centerLng: 73.0, publish: false });
      const result = await deliverable().execute({ lat: 19.0, lng: 73.0 });
      expect(result.getValue().restaurantIds).toEqual([]);
    });

    it('excludes a zone whose restaurant is paused (INACTIVE)', async () => {
      await seed({ withZone: true, centerLat: 19.0, centerLng: 73.0, pause: true });
      const result = await deliverable().execute({ lat: 19.0, lng: 73.0 });
      expect(result.getValue().restaurantIds).toEqual([]);
    });

    it('agrees with CheckServiceability on the same point', async () => {
      await seed({ withZone: true, centerLat: 19.0, centerLng: 73.0 });
      await seed({ withZone: true, centerLat: 19.0, centerLng: 73.0 });
      await seed({ withZone: true, centerLat: 19.0, centerLng: 73.0, pause: true });

      const ids = (await deliverable().execute({ lat: 19.0, lng: 73.0 })).getValue().restaurantIds;
      const serviceable = await new CheckServiceability(deliveryZoneRepo, queryRepo).execute({
        lat: 19.0,
        lng: 73.0,
      });

      expect(ids).toHaveLength(2);
      expect([...ids].sort()).toEqual(serviceable.getValue().map((v) => v.restaurantId).sort());
    });

    it('restricts browse to deliverable restaurants when deliverableOnly is set', async () => {
      const inZone = await seed({ withZone: true, centerLat: 19.0, centerLng: 73.0 });
      await seed(); // published, but no delivery zone covering the point

      const all = await new ListRestaurants(readRepo, deliveryZoneRepo, queryRepo).execute({
        limit: 50,
      });
      expect(all.getValue().items.length).toBe(2);

      const only = await new ListRestaurants(readRepo, deliveryZoneRepo, queryRepo).execute({
        limit: 50,
        deliverableOnly: true,
        lat: 19.0,
        lng: 73.0,
      });
      expect(only.getValue().items.map((r) => r.id)).toEqual([inZone.restaurant.id.toString()]);
    });
  });
});
