import { randomUUID } from 'crypto';
import { Restaurant } from '../../../domain/catalog/entities/Restaurant';
import { CatalogVisibility } from '../../../domain/catalog/value-objects/CatalogVisibility.vo';
import { CATALOG_VISIBILITY } from '../../../domain/catalog/enums/catalog-visibility.enum';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoRestaurantRepository } from '../../../infrastructure/repositories/RestaurantRepository';
import { MongoMenuItemRepository } from '../../../infrastructure/repositories/MenuItemRepository';
import { MongoCatalogReadRepository } from '../../../infrastructure/repositories/CatalogReadRepository';
import { MongoCatalogQueryRepository } from '../../../infrastructure/repositories/CatalogQueryRepository';
import { RestaurantModel } from '../../../infrastructure/database/models/RestaurantModel';
import { MenuItemModel } from '../../../infrastructure/database/models/MenuItemModel';
import { OpeningHours } from '../../../domain/catalog/value-objects/OpeningHours.vo';
import { buildRestaurant, buildMenuItem, buildOpeningHours } from './catalog-fixtures';

function collectStages(plan: Record<string, unknown> | undefined): string[] {
  if (!plan) return [];
  const stages: string[] = [];
  if (typeof plan.stage === 'string') stages.push(plan.stage);
  if (plan.inputStage) stages.push(...collectStages(plan.inputStage as Record<string, unknown>));
  if (Array.isArray(plan.inputStages)) {
    for (const s of plan.inputStages) stages.push(...collectStages(s as Record<string, unknown>));
  }
  return stages;
}

async function winningStages(cursor: { explain: (v: string) => Promise<unknown> }): Promise<string[]> {
  const result = (await cursor.explain('queryPlanner')) as {
    queryPlanner?: { winningPlan?: Record<string, unknown> };
  };
  return collectStages(result.queryPlanner?.winningPlan);
}

function makeActivePublic(): Restaurant {
  const r = buildRestaurant({ slug: `r-${randomUUID().slice(0, 8)}`, withCategory: true });
  r.publish();
  r.setVisibility(CatalogVisibility.create(CATALOG_VISIBILITY.PUBLIC).getValue());
  return r;
}

/**
 * Batch 2.3 — the restaurant menu is assembled from `restaurants` + `menu_items` on read
 * instead of the retired `restaurant_menu_view` projection. These cases pin the assembly
 * rules the projection used to encode, and that the item query is index-covered.
 */
describe('getRestaurantMenu (source-of-truth assembly)', () => {
  const txContext = new TransactionContext();
  const restaurantRepo = new MongoRestaurantRepository(txContext);
  const menuItemRepo = new MongoMenuItemRepository(txContext);
  const readRepo = new MongoCatalogReadRepository(new MongoCatalogQueryRepository());

  beforeAll(async () => {
    await MenuItemModel.syncIndexes();
    await RestaurantModel.syncIndexes();
  });

  afterEach(async () => {
    await Promise.all([RestaurantModel.deleteMany({}), MenuItemModel.deleteMany({})]);
  });

  it('orders categories by sortOrder and items by _id, dropping inactive categories and deleted items', async () => {
    const restaurant = makeActivePublic();
    const id = restaurant.id.toString();
    const starters = restaurant.categories[0].id.toString();
    const mains = restaurant.addCategory('Mains', 5).getValue().id.toString();
    const retired = restaurant.addCategory('Retired', 1).getValue().id.toString();
    expect(restaurant.updateCategory(retired, { isActive: false }).isSuccess).toBe(true);
    await restaurantRepo.save(restaurant);

    // Saved oldest-first so `_id` ascending is a meaningful, non-incidental ordering.
    const first = buildMenuItem({ restaurantId: id, categoryId: starters, name: 'Papad' });
    const second = buildMenuItem({ restaurantId: id, categoryId: starters, name: 'Soup' });
    const inMains = buildMenuItem({ restaurantId: id, categoryId: mains, name: 'Biryani' });
    const inRetired = buildMenuItem({ restaurantId: id, categoryId: retired, name: 'Ghost' });
    const orphan = buildMenuItem({ restaurantId: id, categoryId: 'no-such-category', name: 'Orphan' });
    const deleted = buildMenuItem({ restaurantId: id, categoryId: starters, name: 'Deleted' });
    for (const item of [first, second, inMains, inRetired, orphan, deleted]) {
      await menuItemRepo.save(item);
    }
    deleted.softDelete();
    await menuItemRepo.update(deleted);

    const menu = await readRepo.getRestaurantMenu(id);
    expect(menu).not.toBeNull();
    expect(menu?.restaurant.id).toBe(id);
    expect(menu?.restaurant.slug).toBe(restaurant.slug);
    expect(menu?.restaurant.isOpen).toBe(true);

    expect(menu?.categories.map((c) => c.label)).toEqual(['Starters', 'Mains']);

    const expectedStarters = [first.id.toString(), second.id.toString()].sort();
    expect(menu?.categories[0].items.map((i) => i.id)).toEqual(expectedStarters);
    expect(menu?.categories[1].items.map((i) => i.name)).toEqual(['Biryani']);
  });

  it('exposes the item view fields the projection carried', async () => {
    const restaurant = makeActivePublic();
    const id = restaurant.id.toString();
    const categoryId = restaurant.categories[0].id.toString();
    await restaurantRepo.save(restaurant);

    const item = buildMenuItem({ restaurantId: id, categoryId, price: 31500 });
    await menuItemRepo.save(item);

    const menu = await readRepo.getRestaurantMenu(id);
    expect(menu?.categories[0].items[0]).toEqual({
      id: item.id.toString(),
      restaurantId: id,
      categoryId,
      name: 'Paneer Tikka',
      description: 'Grilled cottage cheese',
      imageUrl: 'https://img.example.com/i.jpg',
      basePriceAmount: 31500,
      currency: 'INR',
      tags: ['spicy', 'popular'],
      dietary: ['VEG'],
      isAvailable: true,
    });
  });

  it('ANDs item availability with the restaurant open state, as the projected view did', async () => {
    const restaurant = makeActivePublic();
    const id = restaurant.id.toString();
    const categoryId = restaurant.categories[0].id.toString();
    // Today is a holiday → closed regardless of the weekly schedule or the wall clock.
    const hours = buildOpeningHours();
    restaurant.setOpeningHours(
      OpeningHours.create({
        schedule: hours.schedule,
        holidays: [new Date().toISOString().slice(0, 10)],
      }).getValue()
    );
    await restaurantRepo.save(restaurant);
    await menuItemRepo.save(buildMenuItem({ restaurantId: id, categoryId }));

    const menu = await readRepo.getRestaurantMenu(id);
    expect(menu?.restaurant.isOpen).toBe(false);
    expect(menu?.categories[0].items[0].isAvailable).toBe(false);
  });

  it('returns null for a restaurant that is not published', async () => {
    const draft = buildRestaurant({ slug: `r-${randomUUID().slice(0, 8)}`, withCategory: true });
    await restaurantRepo.save(draft);
    expect(await readRepo.getRestaurantMenu(draft.id.toString())).toBeNull();

    const hidden = makeActivePublic();
    hidden.setVisibility(CatalogVisibility.create(CATALOG_VISIBILITY.HIDDEN).getValue());
    await restaurantRepo.save(hidden);
    expect(await readRepo.getRestaurantMenu(hidden.id.toString())).toBeNull();
  });

  it('serves the menu item query from an index, not a collection scan', async () => {
    const docs = Array.from({ length: 150 }, (_, i) => ({
      _id: `mi-${i}`,
      restaurantId: `rest-${i % 5}`,
      categoryId: `cat-${i % 3}`,
      name: `Item ${i}`,
      description: null,
      imageUrl: null,
      basePrice: { amount: 10000 + i, currency: 'INR' },
      tags: [],
      dietary: [],
      availability: { isAvailable: true, outOfStockReason: null },
      variantGroups: [],
      deletedAt: null,
    }));
    await MenuItemModel.insertMany(docs);

    const stages = await winningStages(
      MenuItemModel.find({ restaurantId: 'rest-2', deletedAt: null }).sort({ _id: 1 })
    );
    expect(stages).toContain('IXSCAN');
    expect(stages).not.toContain('COLLSCAN');
  });
});
