import { getConnection } from '../../../infrastructure/database/connection';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUnitOfWork } from '../../../infrastructure/database/MongoUnitOfWork';
import { MongoOutboxStore } from '../../../infrastructure/database/MongoOutboxStore';
import { MongoRestaurantRepository } from '../../../infrastructure/repositories/RestaurantRepository';
import { RestaurantModel } from '../../../infrastructure/database/models/RestaurantModel';
import { OutboxEventModel } from '../../../infrastructure/database/models/OutboxEventModel';
import { buildRestaurant } from './catalog-fixtures';
import { randomUUID } from 'crypto';

describe('Catalog aggregate + outbox atomic write', () => {
  let txContext: TransactionContext;
  let uow: MongoUnitOfWork;
  let store: MongoOutboxStore;
  let repo: MongoRestaurantRepository;

  beforeEach(() => {
    txContext = new TransactionContext();
    uow = new MongoUnitOfWork(getConnection(), txContext);
    store = new MongoOutboxStore(txContext);
    repo = new MongoRestaurantRepository(txContext);
  });

  afterEach(async () => {
    await RestaurantModel.deleteMany({});
    await OutboxEventModel.deleteMany({});
  });

  it('commits the restaurant and its outbox rows together', async () => {
    const restaurant = buildRestaurant({ slug: `r-${randomUUID().slice(0, 8)}` });
    const events = restaurant.pullDomainEvents();
    expect(events.length).toBeGreaterThan(0);

    await uow.runInTransaction(async (ctx) => {
      await repo.save(restaurant);
      await store.append(events, ctx);
    });

    expect(await RestaurantModel.findById(restaurant.id.toString()).lean()).not.toBeNull();
    const rows = await OutboxEventModel.find({ aggregateId: restaurant.id.toString() }).lean();
    expect(rows.length).toBe(events.length);
    expect(rows.some((r) => r.eventName === 'RestaurantCreated')).toBe(true);
  });

  it('rolls back BOTH the restaurant and the outbox rows when the work throws', async () => {
    const restaurant = buildRestaurant({ slug: `r-${randomUUID().slice(0, 8)}` });
    const events = restaurant.pullDomainEvents();

    await expect(
      uow.runInTransaction(async (ctx) => {
        await repo.save(restaurant);
        await store.append(events, ctx);
        throw new Error('boom after append');
      })
    ).rejects.toThrow('boom after append');

    expect(await RestaurantModel.findById(restaurant.id.toString()).lean()).toBeNull();
    expect(await OutboxEventModel.countDocuments({ aggregateId: restaurant.id.toString() })).toBe(0);
  });
});
