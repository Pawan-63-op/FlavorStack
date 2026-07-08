import { randomUUID } from 'crypto';
import { Restaurant } from '../../../domain/catalog/entities/Restaurant';
import { MenuItem } from '../../../domain/catalog/entities/MenuItem';
import { OpeningHours, WeeklySchedule } from '../../../domain/catalog/value-objects/OpeningHours.vo';
import { CatalogVisibility } from '../../../domain/catalog/value-objects/CatalogVisibility.vo';
import { ItemAvailability } from '../../../domain/catalog/value-objects/ItemAvailability.vo';
import { CATALOG_VISIBILITY } from '../../../domain/catalog/enums/catalog-visibility.enum';
import { WEEKDAY } from '../../../domain/catalog/enums/weekday.enum';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoRestaurantRepository } from '../../../infrastructure/repositories/RestaurantRepository';
import { MongoMenuItemRepository } from '../../../infrastructure/repositories/MenuItemRepository';
import { MongoSearchService } from '../../../infrastructure/search/MongoSearchService';
import { CatalogProjectionWriter } from '../../../infrastructure/database/projections/CatalogProjectionWriter';
import { RestaurantModel } from '../../../infrastructure/database/models/RestaurantModel';
import { MenuItemModel } from '../../../infrastructure/database/models/MenuItemModel';
import { RestaurantSummaryModel } from '../../../infrastructure/database/models/RestaurantSummaryModel';
import { RestaurantMenuViewModel } from '../../../infrastructure/database/models/RestaurantMenuViewModel';
import { MenuItemSearchModel } from '../../../infrastructure/database/models/MenuItemSearchModel';
import { InMemoryEventBus } from '../../../application/shared/events/InMemoryEventBus';
import { CatalogProjector } from '../../../application/catalog/handlers/CatalogProjector';
import { registerCatalogProjector } from '../../../application/catalog/handlers/CatalogProjectionRegistry';
import { SearchRestaurants } from '../../../application/catalog/use-cases/SearchRestaurants';
import { SearchMenuItems } from '../../../application/catalog/use-cases/SearchMenuItems';
import { GetNearbyRestaurants } from '../../../application/catalog/use-cases/GetNearbyRestaurants';
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

describe('Catalog search & discovery (MongoSearchService)', () => {
  let txContext: TransactionContext;
  let restaurantRepo: MongoRestaurantRepository;
  let menuItemRepo: MongoMenuItemRepository;
  let searchService: MongoSearchService;
  let projector: CatalogProjector;
  let bus: InMemoryEventBus;

  beforeAll(async () => {
    await RestaurantSummaryModel.createIndexes();
    await MenuItemSearchModel.createIndexes();
  });

  beforeEach(() => {
    txContext = new TransactionContext();
    restaurantRepo = new MongoRestaurantRepository(txContext);
    menuItemRepo = new MongoMenuItemRepository(txContext);
    searchService = new MongoSearchService();
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

  interface SeedOpts {
    name?: string;
    cuisineTypes?: string[];
    visibility?: string;
    pause?: boolean;
    closed?: boolean;
    centerLat?: number;
    centerLng?: number;
    items?: Array<{ name?: string; tags?: string[]; dietary?: string[]; available?: boolean }>;
  }

  async function seed(opts: SeedOpts = {}): Promise<{ restaurant: Restaurant; items: MenuItem[] }> {
    const restaurant = buildRestaurant({
      slug: uniqueSlug(),
      name: opts.name,
      cuisineTypes: opts.cuisineTypes,
      withCategory: true,
      centerLat: opts.centerLat,
      centerLng: opts.centerLng,
    });
    if (opts.closed) restaurant.setOpeningHours(closedHours());
    restaurant.publish();
    if (opts.pause) restaurant.pause();
    const visibility = opts.visibility ?? CATALOG_VISIBILITY.PUBLIC;
    restaurant.setVisibility(CatalogVisibility.create(visibility as 'PUBLIC').getValue());

    await restaurantRepo.save(restaurant);
    await bus.publishAll(restaurant.pullDomainEvents());

    const categoryId = restaurant.categories[0].id.toString();
    const items: MenuItem[] = [];
    const itemSpecs = opts.items ?? [{}];
    for (const spec of itemSpecs) {
      const item = buildMenuItem({
        restaurantId: restaurant.id.toString(),
        categoryId,
        name: spec.name,
        tags: spec.tags,
        dietary: spec.dietary,
      });
      if (spec.available === false) {
        item.toggleAvailability(
          ItemAvailability.create({ isAvailable: false, outOfStockReason: 'sold out' }).getValue()
        );
      }
      await menuItemRepo.save(item);
      await bus.publishAll(item.pullDomainEvents());
      items.push(item);
    }

    return { restaurant, items };
  }

  describe('SearchRestaurants', () => {
    it('returns text-matched restaurants and excludes non-matches', async () => {
      await seed({ name: 'Pizza Palace' });
      await seed({ name: 'Pizza Hut' });
      await seed({ name: 'Burger Barn' });

      const result = await new SearchRestaurants(searchService).execute({ query: 'pizza', limit: 50 });
      expect(result.isSuccess).toBe(true);
      const names = result.getValue().items.map((r) => r.name).sort();
      expect(names).toEqual(['Pizza Hut', 'Pizza Palace']);
    });

    it('surfaces only PUBLIC + ACTIVE restaurants (hidden/paused excluded)', async () => {
      await seed({ name: 'Pizza Palace' });
      await seed({ name: 'Pizza Hidden', visibility: CATALOG_VISIBILITY.HIDDEN });
      await seed({ name: 'Pizza Paused', pause: true });

      const result = await new SearchRestaurants(searchService).execute({ query: 'pizza', limit: 50 });
      const names = result.getValue().items.map((r) => r.name);
      expect(names).toEqual(['Pizza Palace']);
    });

    it('composes a cuisine filter on top of the text query', async () => {
      await seed({ name: 'Pizza Italiano', cuisineTypes: ['ITALIAN'] });
      await seed({ name: 'Pizza Desi', cuisineTypes: ['NORTH_INDIAN'] });

      const result = await new SearchRestaurants(searchService).execute({
        query: 'pizza',
        cuisineTypes: ['ITALIAN'],
        limit: 50,
      });
      const names = result.getValue().items.map((r) => r.name);
      expect(names).toEqual(['Pizza Italiano']);
    });

    it('applies the derived isOpenNow filter', async () => {
      await seed({ name: 'Pizza Closed', closed: true });

      const open = await new SearchRestaurants(searchService).execute({
        query: 'pizza',
        isOpenNow: true,
        limit: 50,
      });
      expect(open.getValue().items).toHaveLength(0);

      const closed = await new SearchRestaurants(searchService).execute({
        query: 'pizza',
        isOpenNow: false,
        limit: 50,
      });
      expect(closed.getValue().items).toHaveLength(1);
    });

    it('paginates with a cursor', async () => {
      await seed({ name: 'Pizza One' });
      await seed({ name: 'Pizza Two' });
      await seed({ name: 'Pizza Three' });

      const first = await new SearchRestaurants(searchService).execute({ query: 'pizza', limit: 2 });
      expect(first.getValue().items).toHaveLength(2);
      expect(first.getValue().nextCursor).toBeDefined();

      const second = await new SearchRestaurants(searchService).execute({
        query: 'pizza',
        limit: 2,
        cursor: first.getValue().nextCursor,
      });
      expect(second.getValue().items).toHaveLength(1);

      const firstIds = first.getValue().items.map((r) => r.id);
      const secondIds = second.getValue().items.map((r) => r.id);
      expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
    });

    it('matches a restaurant by cuisine via free text (name does not contain the term)', async () => {
      await seed({ name: 'Bella Trattoria', cuisineTypes: ['ITALIAN'] });
      await seed({ name: 'Spice Route', cuisineTypes: ['NORTH_INDIAN'] });

      const result = await new SearchRestaurants(searchService).execute({ query: 'italian', limit: 50 });
      const names = result.getValue().items.map((r) => r.name);
      expect(names).toEqual(['Bella Trattoria']);
    });

    it('ranks a name hit above a cuisine-only hit (name weighted higher)', async () => {
      await seed({ name: 'Italian Express', cuisineTypes: ['FAST_FOOD'] });
      await seed({ name: 'Corner Cafe', cuisineTypes: ['ITALIAN'] });

      const result = await new SearchRestaurants(searchService).execute({ query: 'italian', limit: 50 });
      const names = result.getValue().items.map((r) => r.name);
      expect(names).toEqual(['Italian Express', 'Corner Cafe']);
    });

    it('falls back to a case-insensitive regex for partial input the text index misses', async () => {
      await seed({ name: 'Bella Trattoria', cuisineTypes: ['ITALIAN'] });
      await seed({ name: 'Spice Route', cuisineTypes: ['NORTH_INDIAN'] });

      const result = await new SearchRestaurants(searchService).execute({ query: 'ital', limit: 50 });
      const names = result.getValue().items.map((r) => r.name);
      expect(names).toEqual(['Bella Trattoria']);
    });

    it('does not fall back to regex when the text index already has hits', async () => {
      await seed({ name: 'Pizza Palace', cuisineTypes: ['ITALIAN'] });

      const exact = await new SearchRestaurants(searchService).execute({ query: 'pizza', limit: 50 });
      expect(exact.getValue().items.map((r) => r.name)).toEqual(['Pizza Palace']);

      const partial = await new SearchRestaurants(searchService).execute({ query: 'pala', limit: 50 });
      expect(partial.getValue().items.map((r) => r.name)).toEqual(['Pizza Palace']);
    });

    it('paginates regex-fallback results with a mode-tagged cursor', async () => {
      await seed({ name: 'Trattoria Uno', cuisineTypes: ['ITALIAN'] });
      await seed({ name: 'Trattoria Due', cuisineTypes: ['ITALIAN'] });
      await seed({ name: 'Trattoria Tre', cuisineTypes: ['ITALIAN'] });

      const first = await new SearchRestaurants(searchService).execute({ query: 'tratt', limit: 2 });
      expect(first.getValue().items).toHaveLength(2);
      expect(first.getValue().nextCursor).toBeDefined();

      const second = await new SearchRestaurants(searchService).execute({
        query: 'tratt',
        limit: 2,
        cursor: first.getValue().nextCursor,
      });
      expect(second.getValue().items).toHaveLength(1);

      const firstIds = first.getValue().items.map((r) => r.id);
      const secondIds = second.getValue().items.map((r) => r.id);
      expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
    });

    it('enforces visibility on the regex-fallback path too', async () => {
      await seed({ name: 'Trattoria Public', cuisineTypes: ['ITALIAN'] });
      await seed({ name: 'Trattoria Hidden', cuisineTypes: ['ITALIAN'], visibility: CATALOG_VISIBILITY.HIDDEN });

      const result = await new SearchRestaurants(searchService).execute({ query: 'tratt', limit: 50 });
      const names = result.getValue().items.map((r) => r.name);
      expect(names).toEqual(['Trattoria Public']);
    });
  });

  describe('SearchMenuItems', () => {
    it('returns text-matched items from public restaurants only', async () => {
      await seed({ name: 'Open House', items: [{ name: 'Margherita Pizza' }, { name: 'Veg Burger' }] });
      await seed({ name: 'Hidden House', visibility: CATALOG_VISIBILITY.HIDDEN, items: [{ name: 'Pepperoni Pizza' }] });

      const result = await new SearchMenuItems(searchService).execute({ query: 'pizza', limit: 50 });
      const names = result.getValue().items.map((i) => i.name);
      expect(names).toEqual(['Margherita Pizza']);
    });

    it('filters by dietary tag', async () => {
      await seed({
        name: 'Diet House',
        items: [
          { name: 'Pizza Veg', dietary: ['VEG'] },
          { name: 'Pizza Chicken', dietary: ['NON_VEG'] },
        ],
      });

      const result = await new SearchMenuItems(searchService).execute({
        query: 'pizza',
        dietary: ['VEG'],
        limit: 50,
      });
      const names = result.getValue().items.map((i) => i.name);
      expect(names).toEqual(['Pizza Veg']);
    });

    it('filters out unavailable items when isAvailable=true', async () => {
      await seed({
        name: 'Stock House',
        items: [
          { name: 'Pizza Available' },
          { name: 'Pizza Soldout', available: false },
        ],
      });

      const result = await new SearchMenuItems(searchService).execute({
        query: 'pizza',
        isAvailable: true,
        limit: 50,
      });
      const names = result.getValue().items.map((i) => i.name);
      expect(names).toEqual(['Pizza Available']);
    });

    it('scopes results to a single restaurant', async () => {
      const a = await seed({ name: 'House A', items: [{ name: 'Pizza Alpha' }] });
      await seed({ name: 'House B', items: [{ name: 'Pizza Beta' }] });

      const result = await new SearchMenuItems(searchService).execute({
        query: 'pizza',
        restaurantId: a.restaurant.id.toString(),
        limit: 50,
      });
      const names = result.getValue().items.map((i) => i.name);
      expect(names).toEqual(['Pizza Alpha']);
    });
  });

  describe('GetNearbyRestaurants', () => {
    it('returns restaurants within the radius, nearest first, and excludes far ones', async () => {
      await seed({ name: 'Near A', centerLat: 19.0, centerLng: 73.0 });
      await seed({ name: 'Near B', centerLat: 19.01, centerLng: 73.0 });
      await seed({ name: 'Far Away', centerLat: 20.0, centerLng: 73.0 });

      const result = await new GetNearbyRestaurants(searchService).execute({
        lat: 19.0,
        lng: 73.0,
        radiusMeters: 5000,
        limit: 50,
      });
      expect(result.isSuccess).toBe(true);
      const names = result.getValue().items.map((r) => r.name);
      expect(names).toEqual(['Near A', 'Near B']); // nearest-first, far one excluded
    });

    it('surfaces only PUBLIC + ACTIVE restaurants within radius', async () => {
      await seed({ name: 'Near Public', centerLat: 19.0, centerLng: 73.0 });
      await seed({ name: 'Near Hidden', visibility: CATALOG_VISIBILITY.HIDDEN, centerLat: 19.0, centerLng: 73.0 });

      const result = await new GetNearbyRestaurants(searchService).execute({
        lat: 19.0,
        lng: 73.0,
        radiusMeters: 5000,
        limit: 50,
      });
      const names = result.getValue().items.map((r) => r.name);
      expect(names).toEqual(['Near Public']);
    });

    it('composes a cuisine filter with proximity', async () => {
      await seed({ name: 'Near Italian', cuisineTypes: ['ITALIAN'], centerLat: 19.0, centerLng: 73.0 });
      await seed({ name: 'Near Indian', cuisineTypes: ['NORTH_INDIAN'], centerLat: 19.001, centerLng: 73.0 });

      const result = await new GetNearbyRestaurants(searchService).execute({
        lat: 19.0,
        lng: 73.0,
        radiusMeters: 5000,
        cuisineTypes: ['ITALIAN'],
        limit: 50,
      });
      const names = result.getValue().items.map((r) => r.name);
      expect(names).toEqual(['Near Italian']);
    });

    it('rejects invalid coordinates', async () => {
      const result = await new GetNearbyRestaurants(searchService).execute({
        lat: 999,
        lng: 73.0,
        radiusMeters: 5000,
      });
      expect(result.isFailure).toBe(true);
    });
  });
});
