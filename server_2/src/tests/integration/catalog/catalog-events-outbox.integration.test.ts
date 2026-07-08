import { randomUUID } from 'crypto';
import { getConnection } from '../../../infrastructure/database/connection';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUnitOfWork } from '../../../infrastructure/database/MongoUnitOfWork';
import { MongoOutboxStore } from '../../../infrastructure/database/MongoOutboxStore';
import { MongoOutboxRepository } from '../../../infrastructure/repositories/OutboxRepository';
import { MongoRestaurantRepository } from '../../../infrastructure/repositories/RestaurantRepository';
import { MongoMenuItemRepository } from '../../../infrastructure/repositories/MenuItemRepository';
import { CatalogProjectionWriter } from '../../../infrastructure/database/projections/CatalogProjectionWriter';
import { CatalogProjector } from '../../../application/catalog/handlers/CatalogProjector';
import { registerCatalogProjector } from '../../../application/catalog/handlers/CatalogProjectionRegistry';
import { InMemoryEventBus } from '../../../application/shared/events/InMemoryEventBus';
import { OutboxProcessor } from '../../../infrastructure/outbox/OutboxProcessor';
import { getOutboxConfig } from '../../../config/outbox';
import { RestaurantModel } from '../../../infrastructure/database/models/RestaurantModel';
import { MenuItemModel } from '../../../infrastructure/database/models/MenuItemModel';
import {
  OutboxEventModel,
  OUTBOX_STATUS,
} from '../../../infrastructure/database/models/OutboxEventModel';
import { RestaurantSummaryModel } from '../../../infrastructure/database/models/RestaurantSummaryModel';
import { RestaurantMenuViewModel } from '../../../infrastructure/database/models/RestaurantMenuViewModel';
import { MenuItemSearchModel } from '../../../infrastructure/database/models/MenuItemSearchModel';
import { CatalogVisibility } from '../../../domain/catalog/value-objects/CatalogVisibility.vo';
import { CATALOG_VISIBILITY } from '../../../domain/catalog/enums/catalog-visibility.enum';
import { Restaurant } from '../../../domain/catalog/entities/Restaurant';
import { buildRestaurant, buildMenuItem } from './catalog-fixtures';

function makeActivePublic(slug: string): Restaurant {
  const r = buildRestaurant({ slug, withCategory: true });
  r.publish();
  r.setVisibility(CatalogVisibility.create(CATALOG_VISIBILITY.PUBLIC).getValue());
  return r;
}

/** Reset every outbox row to PENDING so the processor re-serves them (redelivery). */
async function redeliverAll(): Promise<void> {
  await OutboxEventModel.updateMany(
    {},
    { $set: { status: OUTBOX_STATUS.PENDING, nextAttemptAt: new Date(), processedAt: null } }
  );
}

describe('Catalog events → outbox → poller → projector (idempotent)', () => {
  let txContext: TransactionContext;
  let uow: MongoUnitOfWork;
  let store: MongoOutboxStore;
  let restaurantRepo: MongoRestaurantRepository;
  let menuItemRepo: MongoMenuItemRepository;
  let processor: OutboxProcessor;

  beforeEach(() => {
    txContext = new TransactionContext();
    uow = new MongoUnitOfWork(getConnection(), txContext);
    store = new MongoOutboxStore(txContext);
    restaurantRepo = new MongoRestaurantRepository(txContext);
    menuItemRepo = new MongoMenuItemRepository(txContext);

    const bus = new InMemoryEventBus();
    const projector = new CatalogProjector(restaurantRepo, menuItemRepo, new CatalogProjectionWriter());
    registerCatalogProjector(bus, projector);
    processor = new OutboxProcessor(new MongoOutboxRepository(txContext), bus, getOutboxConfig());
  });

  afterEach(async () => {
    await Promise.all([
      RestaurantModel.deleteMany({}),
      MenuItemModel.deleteMany({}),
      OutboxEventModel.deleteMany({}),
      RestaurantSummaryModel.deleteMany({}),
      RestaurantMenuViewModel.deleteMany({}),
      MenuItemSearchModel.deleteMany({}),
    ]);
  });

  async function seedRestaurantWithItems(itemCount: number): Promise<{ restaurantId: string }> {
    const restaurant = makeActivePublic(`r-${randomUUID().slice(0, 8)}`);
    const restaurantId = restaurant.id.toString();
    const categoryId = restaurant.categories[0].id.toString();
    const restaurantEvents = restaurant.pullDomainEvents();

    await uow.runInTransaction(async (ctx) => {
      await restaurantRepo.save(restaurant);
      await store.append(restaurantEvents, ctx);
    });

    for (let i = 0; i < itemCount; i++) {
      const item = buildMenuItem({ restaurantId, categoryId, name: `Item ${i}`, price: 10000 + i });
      const itemEvents = item.pullDomainEvents();
      await uow.runInTransaction(async (ctx) => {
        await menuItemRepo.save(item);
        await store.append(itemEvents, ctx);
      });
    }

    return { restaurantId };
  }

  it('tags outbox rows with the correct aggregateType per aggregate', async () => {
    await seedRestaurantWithItems(2);

    const restaurantRows = await OutboxEventModel.find({ eventName: 'RestaurantCreated' }).lean();
    const itemRows = await OutboxEventModel.find({ eventName: 'MenuItemCreated' }).lean();

    expect(restaurantRows.length).toBe(1);
    expect(restaurantRows[0].aggregateType).toBe('restaurant');
    expect(itemRows.length).toBe(2);
    expect(itemRows.every((r) => r.aggregateType === 'menu_item')).toBe(true);
  });

  it('drains outbox rows and builds the projections, settling rows PROCESSED', async () => {
    const { restaurantId } = await seedRestaurantWithItems(3);

    expect(await OutboxEventModel.countDocuments({ status: OUTBOX_STATUS.PENDING })).toBeGreaterThan(0);

    await processor.processBatch();

    expect(await OutboxEventModel.countDocuments({ status: OUTBOX_STATUS.PENDING })).toBe(0);
    expect(await OutboxEventModel.countDocuments({ status: OUTBOX_STATUS.PROCESSED })).toBeGreaterThan(0);

    expect(await RestaurantSummaryModel.countDocuments({ _id: restaurantId })).toBe(1);
    expect(await RestaurantMenuViewModel.countDocuments({ _id: restaurantId })).toBe(1);
    expect(await MenuItemSearchModel.countDocuments({ restaurantId })).toBe(3);
  });

  it('is idempotent under redelivery — replay yields identical projections, no duplicates', async () => {
    const { restaurantId } = await seedRestaurantWithItems(3);

    await processor.processBatch();
    const afterFirst = await MenuItemSearchModel.find({ restaurantId }).sort({ _id: 1 }).lean();
    expect(afterFirst.length).toBe(3);

    await redeliverAll();
    await expect(processor.processBatch()).resolves.toBeUndefined();

    const afterReplay = await MenuItemSearchModel.find({ restaurantId }).sort({ _id: 1 }).lean();
    expect(afterReplay.length).toBe(3); // no duplicate _id / no E11000
    expect(afterReplay.map((d) => d._id)).toEqual(afterFirst.map((d) => d._id));
    expect(await RestaurantSummaryModel.countDocuments({ _id: restaurantId })).toBe(1);
    expect(await RestaurantMenuViewModel.countDocuments({ _id: restaurantId })).toBe(1);
  });
});
