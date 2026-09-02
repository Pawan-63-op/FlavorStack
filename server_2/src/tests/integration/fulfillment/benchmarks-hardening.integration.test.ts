import { randomUUID } from 'crypto';

import { Fulfillment } from '../../../domain/fulfillment/entities/Fulfillment';
import { FulfillmentLine } from '../../../domain/fulfillment/value-objects/FulfillmentLine';
import { DeliveryAddress } from '../../../domain/fulfillment/value-objects/DeliveryAddress';
import { FULFILLMENT_STATUS } from '../../../domain/fulfillment/enums/fulfillment-status.enum';
import { Money } from '../../../domain/shared/Money';
import { Result } from '../../../domain/shared/Result';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';

import { getConnection } from '../../../infrastructure/database/connection';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUnitOfWork } from '../../../infrastructure/database/MongoUnitOfWork';
import { MongoOutboxStore } from '../../../infrastructure/database/MongoOutboxStore';
import { MongoFulfillmentRepository } from '../../../infrastructure/repositories/FulfillmentRepository';
import { MongoCustomerTrackingRepository } from '../../../infrastructure/repositories/CustomerTrackingRepository';
import { MongoFulfillmentQueryRepository } from '../../../infrastructure/repositories/FulfillmentQueryRepository';
import { MongoDeliveryTrackingStore } from '../../../infrastructure/repositories/DeliveryTrackingStore';
import { CacheStore } from '../../../infrastructure/redis/CacheStore';
import { RedisClient } from '../../../infrastructure/redis/client';
import { FulfillmentCache } from '../../../infrastructure/redis/fulfillment/FulfillmentCache';

import { FulfillmentModel } from '../../../infrastructure/database/models/FulfillmentModel';
import { OutboxEventModel } from '../../../infrastructure/database/models/OutboxEventModel';
import { CustomerTrackingViewModel } from '../../../infrastructure/database/models/CustomerTrackingViewModel';
import { DeliveryTrackingModel } from '../../../infrastructure/database/models/DeliveryTrackingModel';

import { GetLiveTracking } from '../../../application/fulfillment/use-cases/GetLiveTracking';
import { GetAdminDashboard } from '../../../application/fulfillment/use-cases/GetAdminDashboard';
import { RecordRiderLocation } from '../../../application/fulfillment/use-cases/RecordRiderLocation';
import { offerExpiry } from '../../../application/fulfillment/use-cases/assignment-helpers';
import { getFulfillmentConfig } from '../../../config/fulfillment';
import { ILiveLocationStore } from '../../../application/fulfillment/ports/ILiveLocationStore';
import { ITrackingBroadcaster } from '../../../application/fulfillment/ports/ITrackingBroadcaster';
import { RiderLocationSnapshot } from '../../../application/fulfillment/ports/RiderLocationSnapshot';
import { CustomerTrackingView } from '../../../domain/fulfillment/repositories/ICustomerTrackingRepository';

const CUSTOMER_ID = 'cust-1';
const RESTAURANT_ID = 'rest-1';
const RIDER_1 = 'rider-1';

function money(amount: number): Money {
  return Money.create(amount, 'INR').getValue();
}

function future(ms = 60_000): Date {
  return new Date(Date.now() + ms);
}

function ms(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1e6;
}

function buildFulfillment(): Fulfillment {
  const line = FulfillmentLine.create({
    menuItemId: 'item-1',
    name: 'Paneer Tikka',
    quantity: 1,
    selectedOptions: [],
    lineTotal: money(40000),
  }).getValue();
  const address = DeliveryAddress.create({
    street: '12 MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pinCode: '560001',
    coordinates: GeoPoint.create(12.97, 77.59).getValue(),
  }).getValue();

  const f = Fulfillment.createFromOrderRequested({
    orderRequestId: `order-${randomUUID().slice(0, 8)}`,
    customerId: CUSTOMER_ID,
    restaurantId: RESTAURANT_ID,
    lines: [line],
    deliveryAddress: address,
    pricingTotal: money(45000),
  }).getValue();
  f.pullDomainEvents();
  return f;
}

class InMemoryCacheStore extends CacheStore {
  private store = new Map<string, string>();
  constructor() {
    super(null as unknown as RedisClient);
  }
  async get<T>(key: string): Promise<T | null> {
    const raw = this.store.get(key);
    return raw === undefined ? null : (JSON.parse(raw) as T);
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, JSON.stringify(value));
  }
  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
  async incr(key: string): Promise<number> {
    const next = Number(this.store.get(key) ?? '0') + 1;
    this.store.set(key, String(next));
    return next;
  }
}

class DownCacheStore extends CacheStore {
  constructor() {
    super(null as unknown as RedisClient);
  }
  async get(): Promise<null> {
    throw new Error('redis down');
  }
  async set(): Promise<void> {
    throw new Error('redis down');
  }
  async del(): Promise<void> {
    throw new Error('redis down');
  }
  async incr(): Promise<number> {
    throw new Error('redis down');
  }
}

class ThrottledLiveStore implements ILiveLocationStore {
  public setLatestCalls = 0;
  private gateExpiry = new Map<string, number>();
  async setLatest(): Promise<void> {
    this.setLatestCalls += 1;
  }
  async getLatest(): Promise<RiderLocationSnapshot | null> {
    return null;
  }
  async tryAcquirePersistSlot(fulfillmentId: string, throttleSeconds: number): Promise<boolean> {
    const now = Date.now();
    const expiry = this.gateExpiry.get(fulfillmentId) ?? 0;
    if (now >= expiry) {
      this.gateExpiry.set(fulfillmentId, now + throttleSeconds * 1000);
      return true;
    }
    return false;
  }
}

describe('Fulfillment benchmarks & production hardening (Phase 9.4)', () => {
  let txContext: TransactionContext;
  let repo: MongoFulfillmentRepository;
  let uow: MongoUnitOfWork;
  let trackingRepo: MongoCustomerTrackingRepository;
  let queryRepo: MongoFulfillmentQueryRepository;

  beforeEach(() => {
    txContext = new TransactionContext();
    repo = new MongoFulfillmentRepository(txContext);
    uow = new MongoUnitOfWork(getConnection(), txContext);
    trackingRepo = new MongoCustomerTrackingRepository();
    queryRepo = new MongoFulfillmentQueryRepository();
  });

  afterEach(async () => {
    await Promise.all([
      FulfillmentModel.deleteMany({}),
      OutboxEventModel.deleteMany({}),
      CustomerTrackingViewModel.deleteMany({}),
      DeliveryTrackingModel.deleteMany({}),
    ]);
  });

  async function seedTracking(fulfillmentId: string): Promise<void> {
    await trackingRepo.upsertCustomerTracking({
      fulfillmentId,
      eventId: randomUUID(),
      set: {
        orderRequestId: `order-${fulfillmentId}`,
        customerId: CUSTOMER_ID,
        restaurantId: RESTAURANT_ID,
        currentStatus: FULFILLMENT_STATUS.PREPARING,
        deliveryStatus: 'UNASSIGNED',
        riderId: null,
        deliveryAddress: {
          street: '12 MG Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pinCode: '560001',
          coordinates: { lat: 12.97, lng: 77.59 },
        },
        total: { amount: 45000, currency: 'INR' },
        cancellation: null,
        failureReason: null,
      } as Partial<CustomerTrackingView>,
      timelineEntry: { eventId: randomUUID(), status: FULFILLMENT_STATUS.PREPARING, at: new Date() },
    });
  }

  /**
   * Phase 3 / Batch 5: the dashboard reads the `fulfillments` aggregate, so the benchmark seeds
   * aggregate documents rather than the retired admin_dashboard_views projection.
   */
  async function seedDashboardRows(count: number): Promise<void> {
    const now = Date.now();
    await FulfillmentModel.insertMany(
      Array.from({ length: count }, (_, i) => ({
        _id: `adm-${i}-${randomUUID().slice(0, 6)}`,
        orderRequestId: `order-${i}`,
        customerId: CUSTOMER_ID,
        restaurantId: RESTAURANT_ID,
        lines: [],
        deliveryAddress: {
          street: '12 MG Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pinCode: '560001',
          coordinates: { lat: 12.97, lng: 77.59 },
        },
        pricingTotal: { amount: 45000, currency: 'INR' },
        fulfillmentStatus: FULFILLMENT_STATUS.PREPARING,
        deliveryStatus: 'UNASSIGNED',
        currentAssignment: null,
        assignmentHistory: [],
        cancellation: null,
        failureReason: null,
        createdAt: new Date(now - i * 1000),
        updatedAt: new Date(now - i * 1000),
        version: 1,
      }))
    );
  }

  describe('hot-read caching baseline (cached vs uncached)', () => {
    it('tracking: a warm read is served from cache and elides the projection read', async () => {
      const id = `ful-${randomUUID().slice(0, 8)}`;
      await seedTracking(id);

      const findSpy = jest.spyOn(trackingRepo, 'findCustomerTracking');
      const cache = new FulfillmentCache(new InMemoryCacheStore());
      const uc = new GetLiveTracking(trackingRepo, cache);

      const t0 = process.hrtime.bigint();
      const cold = await uc.execute({ fulfillmentId: id, customerId: CUSTOMER_ID });
      const coldMs = ms(t0);

      const t1 = process.hrtime.bigint();
      const warm = await uc.execute({ fulfillmentId: id, customerId: CUSTOMER_ID });
      const warmMs = ms(t1);

      expect(cold.isSuccess).toBe(true);
      expect(warm.isSuccess).toBe(true);
      expect(findSpy).toHaveBeenCalledTimes(1); // warm read never touched Mongo
      console.log(`[bench] tracking cold=${coldMs.toFixed(2)}ms warm=${warmMs.toFixed(2)}ms (cached)`);
      findSpy.mockRestore();
    });

    it('dashboard: a warm read is served from cache and elides the projection read', async () => {
      await seedDashboardRows(25);

      const findSpy = jest.spyOn(queryRepo, 'findAdminDashboard');
      const cache = new FulfillmentCache(new InMemoryCacheStore());
      const uc = new GetAdminDashboard(queryRepo, cache);
      const dto = { status: FULFILLMENT_STATUS.PREPARING, limit: 50, offset: 0 };

      const t0 = process.hrtime.bigint();
      const cold = await uc.execute(dto);
      const coldMs = ms(t0);

      const t1 = process.hrtime.bigint();
      const warm = await uc.execute(dto);
      const warmMs = ms(t1);

      expect(cold.getValue()).toHaveLength(25);
      expect(warm.getValue()).toHaveLength(25);
      expect(findSpy).toHaveBeenCalledTimes(1);
      console.log(`[bench] dashboard cold=${coldMs.toFixed(2)}ms warm=${warmMs.toFixed(2)}ms (cached, 25 rows)`);
      findSpy.mockRestore();
    });
  });

  describe('write-transition latency baseline', () => {
    it('records the per-transition latency of the transactional update path', async () => {
      const f = buildFulfillment();
      await repo.save(f);
      const id = f.id.toString();

      const transitions: Array<(x: Fulfillment) => Result<void>> = [
        (x) => x.startPreparation(RESTAURANT_ID),
        (x) => x.markReadyForPickup(RESTAURANT_ID),
        (x) => x.offerToRider(RIDER_1, future()),
        (x) => x.acceptByRider(RIDER_1),
        (x) => x.confirmPickup(RIDER_1),
        (x) => x.startDelivery(RIDER_1),
        (x) => x.completeDelivery(RIDER_1),
      ];

      const samples: number[] = [];
      for (const t of transitions) {
        const loaded = (await repo.findById(id)) as Fulfillment;
        expect(t(loaded).isSuccess).toBe(true);
        loaded.pullDomainEvents();
        const start = process.hrtime.bigint();
        await uow.runInTransaction(async () => {
          await repo.update(loaded);
        });
        samples.push(ms(start));
      }

      const reloaded = (await repo.findById(id)) as Fulfillment;
      expect(reloaded.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.DELIVERED);

      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      const max = Math.max(...samples);
      console.log(`[bench] write-transition avg=${avg.toFixed(2)}ms max=${max.toFixed(2)}ms n=${samples.length}`);
      expect(samples).toHaveLength(7);
    });
  });

  describe('graceful degradation when Redis is down (no hard dependency)', () => {
    it('tracking read falls back to Mongo when the cache faults', async () => {
      const id = `ful-${randomUUID().slice(0, 8)}`;
      await seedTracking(id);

      const cache = new FulfillmentCache(new DownCacheStore());
      const uc = new GetLiveTracking(trackingRepo, cache);

      const result = await uc.execute({ fulfillmentId: id, customerId: CUSTOMER_ID });
      expect(result.isSuccess).toBe(true);
      expect(result.getValue().currentStatus).toBe(FULFILLMENT_STATUS.PREPARING);
    });

    it('dashboard read falls back to Mongo when the cache faults', async () => {
      await seedDashboardRows(5);

      const cache = new FulfillmentCache(new DownCacheStore());
      const uc = new GetAdminDashboard(queryRepo, cache);

      const result = await uc.execute({ status: FULFILLMENT_STATUS.PREPARING });
      expect(result.isSuccess).toBe(true);
      expect(result.getValue()).toHaveLength(5);
    });

    it('cache invalidation is best-effort and never throws when Redis is down', async () => {
      const cache = new FulfillmentCache(new DownCacheStore());
      await expect(cache.invalidateFulfillment('ful-x')).resolves.toBeUndefined();
    });
  });

  describe('realtime write-amplification bound (tracking pings)', () => {
    it('N pings within one throttle window persist ~1 Mongo row while every ping hits Redis', async () => {
      const f = buildFulfillment();
      await repo.save(f);
      const id = f.id.toString();
      const advance: Array<(x: Fulfillment) => Result<void>> = [
        (x) => x.startPreparation(RESTAURANT_ID),
        (x) => x.markReadyForPickup(RESTAURANT_ID),
        (x) => x.offerToRider(RIDER_1, future()),
        (x) => x.acceptByRider(RIDER_1),
      ];
      for (const step of advance) {
        const loaded = (await repo.findById(id)) as Fulfillment;
        expect(step(loaded).isSuccess).toBe(true);
        loaded.pullDomainEvents();
        await repo.update(loaded);
      }

      const liveStore = new ThrottledLiveStore();
      const trackingStore = new MongoDeliveryTrackingStore();
      const broadcaster: ITrackingBroadcaster = {
        broadcastLocation: jest.fn(),
        broadcastStatus: jest.fn(),
      };
      const throttleSeconds = 5;
      const uc = new RecordRiderLocation(repo, liveStore, trackingStore, broadcaster, throttleSeconds);

      const PINGS = 20;
      let persistedCount = 0;
      for (let i = 0; i < PINGS; i += 1) {
        const r = await uc.execute({ fulfillmentId: id, riderId: RIDER_1, lat: 12.97 + i * 1e-4, lng: 77.59 });
        expect(r.isSuccess).toBe(true);
        if (r.getValue().persisted) persistedCount += 1;
      }

      const rows = await DeliveryTrackingModel.countDocuments({ fulfillmentId: id });
      console.log(`[bench] ${PINGS} pings → mongoRows=${rows} redisSetLatest=${liveStore.setLatestCalls} (throttle ${throttleSeconds}s)`);

      expect(liveStore.setLatestCalls).toBe(PINGS); // every ping → Redis latest write
      expect(broadcaster.broadcastLocation).toHaveBeenCalledTimes(PINGS); // every ping → broadcast
      expect(rows).toBe(1); // throttle bounds durable writes to one per window
      expect(persistedCount).toBe(1);
    });
  });

  describe('centralized config is the single source of truth', () => {
    it('TTL / SLA / attempt limits are env-overridable from getFulfillmentConfig, and the aggregate offer TTL agrees', () => {
      const saved = {
        ttl: process.env.FULFILLMENT_OFFER_TTL_SECONDS,
        att: process.env.FULFILLMENT_MAX_ASSIGNMENT_ATTEMPTS,
        ready: process.env.FULFILLMENT_READY_SLA_SECONDS,
        deliver: process.env.FULFILLMENT_DELIVERY_SLA_SECONDS,
      };
      try {
        process.env.FULFILLMENT_OFFER_TTL_SECONDS = '45';
        process.env.FULFILLMENT_MAX_ASSIGNMENT_ATTEMPTS = '5';
        process.env.FULFILLMENT_READY_SLA_SECONDS = '600';
        process.env.FULFILLMENT_DELIVERY_SLA_SECONDS = '1800';

        const cfg = getFulfillmentConfig();
        expect(cfg.offerTtlSeconds).toBe(45);
        expect(cfg.maxAssignmentAttempts).toBe(5);
        expect(cfg.readyForPickupSlaSeconds).toBe(600);
        expect(cfg.outForDeliverySlaSeconds).toBe(1800);

        const before = Date.now();
        const expiry = offerExpiry(cfg.offerTtlSeconds);
        expect(expiry.getTime() - before).toBeGreaterThanOrEqual(44_000);
        expect(expiry.getTime() - before).toBeLessThanOrEqual(46_000);
      } finally {
        process.env.FULFILLMENT_OFFER_TTL_SECONDS = saved.ttl;
        process.env.FULFILLMENT_MAX_ASSIGNMENT_ATTEMPTS = saved.att;
        process.env.FULFILLMENT_READY_SLA_SECONDS = saved.ready;
        process.env.FULFILLMENT_DELIVERY_SLA_SECONDS = saved.deliver;
      }
    });

    it('falls back to documented defaults when no env overrides are set', () => {
      const saved = {
        ttl: process.env.FULFILLMENT_OFFER_TTL_SECONDS,
        att: process.env.FULFILLMENT_MAX_ASSIGNMENT_ATTEMPTS,
      };
      try {
        delete process.env.FULFILLMENT_OFFER_TTL_SECONDS;
        delete process.env.FULFILLMENT_MAX_ASSIGNMENT_ATTEMPTS;
        const cfg = getFulfillmentConfig();
        expect(cfg.offerTtlSeconds).toBe(60);
        expect(cfg.maxAssignmentAttempts).toBe(3);
      } finally {
        process.env.FULFILLMENT_OFFER_TTL_SECONDS = saved.ttl;
        process.env.FULFILLMENT_MAX_ASSIGNMENT_ATTEMPTS = saved.att;
      }
    });
  });

  describe('outbox atomicity (replica-set requirement)', () => {
    // Drives MongoOutboxStore directly: this block covers the UnitOfWork/replica-set
    // atomicity contract, not fulfillment's use of the outbox (removed in Phase 7).
    const outbox = new MongoOutboxStore(new TransactionContext());

    it('commits the aggregate and its outbox rows in one transaction', async () => {
      const f = buildFulfillment();
      const loaded = await (async () => {
        await repo.save(f);
        return (await repo.findById(f.id.toString())) as Fulfillment;
      })();
      expect(loaded.startPreparation(RESTAURANT_ID).isSuccess).toBe(true);
      const events = loaded.pullDomainEvents();

      await uow.runInTransaction(async (ctx) => {
        await repo.update(loaded);
        await outbox.append(events, ctx);
      });

      const persisted = (await repo.findById(f.id.toString())) as Fulfillment;
      expect(persisted.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.PREPARING);
      expect(await OutboxEventModel.countDocuments({ aggregateId: f.id.toString() })).toBe(events.length);
      expect(events.length).toBeGreaterThan(0);
    });

    it('rolls back both the aggregate write and the outbox rows when the transaction throws', async () => {
      const f = buildFulfillment();
      await repo.save(f);
      const loaded = (await repo.findById(f.id.toString())) as Fulfillment;
      expect(loaded.startPreparation(RESTAURANT_ID).isSuccess).toBe(true);
      const events = loaded.pullDomainEvents();

      await expect(
        uow.runInTransaction(async (ctx) => {
          await repo.update(loaded);
          await outbox.append(events, ctx);
          throw new Error('boom — force rollback');
        })
      ).rejects.toThrow('boom');

      const persisted = (await repo.findById(f.id.toString())) as Fulfillment;
      expect(persisted.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.CREATED);
      expect(await OutboxEventModel.countDocuments({ aggregateId: f.id.toString() })).toBe(0);
    });
  });
});
