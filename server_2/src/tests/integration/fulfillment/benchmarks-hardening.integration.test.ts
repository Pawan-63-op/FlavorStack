// Integration (real Mongo replica set) for Phase 9.4 — Benchmarks & Production Hardening.
//
// This is a baseline + safeguard harness, NOT a perf framework. It:
//   • records cached-vs-uncached hot-read baselines (tracking + dashboard) and proves the cache
//     elides the second projection read;
//   • records a write-transition latency baseline over the transactional update path;
//   • proves the read path and the projector's invalidation DEGRADE GRACEFULLY when Redis is down
//     (cache faults fall back to Mongo / become best-effort no-ops — no hard dependency);
//   • proves the tracking-ping throttle bounds write amplification (N pings → ~1 Mongo write/window);
//   • proves TTL/SLA/attempt limits come from the single centralized config source;
//   • proves outbox writes commit atomically with the aggregate (the replica-set transaction
//     requirement) and that the DLQ wiring routes exhausted jobs to the dead-letter queue.
//
// Recorded numbers are echoed via console and captured in
// fulfillment_module_phase_summary/batch_9.4_hardening.md.
import { randomUUID } from 'crypto';
import type { Job, Queue } from 'bullmq';

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
import { MongoFulfillmentProjectionRepository } from '../../../infrastructure/repositories/FulfillmentProjectionRepository';
import { MongoDeliveryTrackingStore } from '../../../infrastructure/repositories/DeliveryTrackingStore';
import { CacheStore } from '../../../infrastructure/redis/CacheStore';
import { RedisClient } from '../../../infrastructure/redis/client';
import { FulfillmentCache } from '../../../infrastructure/redis/fulfillment/FulfillmentCache';
import { DLQHandler } from '../../../infrastructure/workers/shared/DLQHandler';
import { QUEUE } from '../../../config/bullmq';

import { FulfillmentModel } from '../../../infrastructure/database/models/FulfillmentModel';
import { OutboxEventModel } from '../../../infrastructure/database/models/OutboxEventModel';
import { CustomerTrackingViewModel } from '../../../infrastructure/database/models/CustomerTrackingViewModel';
import { AdminDashboardViewModel } from '../../../infrastructure/database/models/AdminDashboardViewModel';
import { DeliveryTrackingModel } from '../../../infrastructure/database/models/DeliveryTrackingModel';

import { GetLiveTracking } from '../../../application/fulfillment/use-cases/GetLiveTracking';
import { GetAdminDashboard } from '../../../application/fulfillment/use-cases/GetAdminDashboard';
import { RecordRiderLocation } from '../../../application/fulfillment/use-cases/RecordRiderLocation';
import { offerExpiry } from '../../../application/fulfillment/use-cases/assignment-helpers';
import { getFulfillmentConfig } from '../../../config/fulfillment';
import { ILiveLocationStore } from '../../../application/fulfillment/ports/ILiveLocationStore';
import { ITrackingBroadcaster } from '../../../application/fulfillment/ports/ITrackingBroadcaster';
import { RiderLocationSnapshot } from '../../../application/fulfillment/ports/RiderLocationSnapshot';
import {
  CustomerTrackingView,
  AdminDashboardView,
} from '../../../domain/fulfillment/repositories/IFulfillmentProjectionRepository';

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

// ── cache doubles ──────────────────────────────────────────────────────────────
// A real FulfillmentCache wraps these, so the production resilience code is exercised for real.
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

// Simulates a hard Redis outage: every command rejects.
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

// In-process emulation of the Redis SET NX EX throttle gate (the distributed guarantee itself is
// covered by RedisLiveLocationStore.integration.test). Lets us assert the RecordRiderLocation
// write-amplification bound without a live Redis.
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
  let outbox: MongoOutboxStore;
  let projectionRepo: MongoFulfillmentProjectionRepository;

  beforeEach(() => {
    txContext = new TransactionContext();
    repo = new MongoFulfillmentRepository(txContext);
    uow = new MongoUnitOfWork(getConnection(), txContext);
    outbox = new MongoOutboxStore(txContext);
    projectionRepo = new MongoFulfillmentProjectionRepository();
  });

  afterEach(async () => {
    await Promise.all([
      FulfillmentModel.deleteMany({}),
      OutboxEventModel.deleteMany({}),
      CustomerTrackingViewModel.deleteMany({}),
      AdminDashboardViewModel.deleteMany({}),
      DeliveryTrackingModel.deleteMany({}),
    ]);
  });

  async function seedTracking(fulfillmentId: string): Promise<void> {
    await projectionRepo.upsertCustomerTracking({
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

  async function seedAdminViews(count: number): Promise<void> {
    for (let i = 0; i < count; i += 1) {
      const view: AdminDashboardView = {
        fulfillmentId: `adm-${i}-${randomUUID().slice(0, 6)}`,
        orderRequestId: `order-${i}`,
        customerId: CUSTOMER_ID,
        restaurantId: RESTAURANT_ID,
        status: FULFILLMENT_STATUS.PREPARING,
        deliveryStatus: 'UNASSIGNED',
        riderId: null,
        createdAt: new Date(Date.now() - i * 1000),
        updatedAt: new Date(),
        slaBreached: false,
        exceptionFlag: false,
        cancellation: null,
        failureReason: null,
        total: { amount: 45000, currency: 'INR' },
      };
      await projectionRepo.upsertAdminView(view);
    }
  }

  describe('hot-read caching baseline (cached vs uncached)', () => {
    it('tracking: a warm read is served from cache and elides the projection read', async () => {
      const id = `ful-${randomUUID().slice(0, 8)}`;
      await seedTracking(id);

      const findSpy = jest.spyOn(projectionRepo, 'findCustomerTracking');
      const cache = new FulfillmentCache(new InMemoryCacheStore());
      const uc = new GetLiveTracking(projectionRepo, cache);

      const t0 = process.hrtime.bigint();
      const cold = await uc.execute({ fulfillmentId: id, customerId: CUSTOMER_ID });
      const coldMs = ms(t0);

      const t1 = process.hrtime.bigint();
      const warm = await uc.execute({ fulfillmentId: id, customerId: CUSTOMER_ID });
      const warmMs = ms(t1);

      expect(cold.isSuccess).toBe(true);
      expect(warm.isSuccess).toBe(true);
      expect(findSpy).toHaveBeenCalledTimes(1); // warm read never touched Mongo
      // eslint-disable-next-line no-console
      console.log(`[bench] tracking cold=${coldMs.toFixed(2)}ms warm=${warmMs.toFixed(2)}ms (cached)`);
      findSpy.mockRestore();
    });

    it('dashboard: a warm read is served from cache and elides the projection read', async () => {
      await seedAdminViews(25);

      const findSpy = jest.spyOn(projectionRepo, 'findAdminDashboard');
      const cache = new FulfillmentCache(new InMemoryCacheStore());
      const uc = new GetAdminDashboard(projectionRepo, cache);
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
      // eslint-disable-next-line no-console
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
      // eslint-disable-next-line no-console
      console.log(`[bench] write-transition avg=${avg.toFixed(2)}ms max=${max.toFixed(2)}ms n=${samples.length}`);
      expect(samples).toHaveLength(7);
    });
  });

  describe('graceful degradation when Redis is down (no hard dependency)', () => {
    it('tracking read falls back to Mongo when the cache faults', async () => {
      const id = `ful-${randomUUID().slice(0, 8)}`;
      await seedTracking(id);

      const cache = new FulfillmentCache(new DownCacheStore());
      const uc = new GetLiveTracking(projectionRepo, cache);

      const result = await uc.execute({ fulfillmentId: id, customerId: CUSTOMER_ID });
      expect(result.isSuccess).toBe(true);
      expect(result.getValue().currentStatus).toBe(FULFILLMENT_STATUS.PREPARING);
    });

    it('dashboard read falls back to Mongo when the cache faults', async () => {
      await seedAdminViews(5);

      const cache = new FulfillmentCache(new DownCacheStore());
      const uc = new GetAdminDashboard(projectionRepo, cache);

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
      // Seed a fulfillment with an ACCEPTED active rider so RecordRiderLocation's ownership guard passes.
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
      // eslint-disable-next-line no-console
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

        // The offer use cases AND the assignment-timeout job both derive the offer's expiry from
        // this single value via offerExpiry — so aggregate and jobs cannot drift apart.
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

  describe('outbox atomicity (replica-set requirement) & DLQ wiring', () => {
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

      // Nothing partially persisted: status unchanged, no outbox rows.
      const persisted = (await repo.findById(f.id.toString())) as Fulfillment;
      expect(persisted.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.CREATED);
      expect(await OutboxEventModel.countDocuments({ aggregateId: f.id.toString() })).toBe(0);
    });

    it('DLQ wiring routes an exhausted job (payload + failure context) to the dead-letter queue', async () => {
      const add = jest.fn(async () => undefined);
      const handler = new DLQHandler({ add } as unknown as Queue);
      const job = {
        name: 'assignment-timeout',
        data: { fulfillmentId: 'ful-1', attempt: 3 },
        attemptsMade: 3,
      } as unknown as Job;

      await handler.handle('fulfillment-queue', job, new Error('handler exhausted'));

      expect(add).toHaveBeenCalledWith(
        QUEUE.dlq,
        expect.objectContaining({
          sourceQueue: 'fulfillment-queue',
          jobName: 'assignment-timeout',
          failedReason: 'handler exhausted',
          attemptsMade: 3,
        })
      );
    });
  });
});
