import { randomUUID } from 'crypto';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoOutboxRepository } from '../../../infrastructure/repositories/OutboxRepository';
import {
  OutboxEventModel,
  OUTBOX_STATUS,
} from '../../../infrastructure/database/models/OutboxEventModel';
import { IOutboxDispatcher } from '../../../application/shared/outbox/IOutboxDispatcher';
import { OutboxDispatcher } from '../../../application/shared/outbox/OutboxDispatcher';
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { OutboxProcessor } from '../../../infrastructure/outbox/OutboxProcessor';
import { OutboxConfig } from '../../../config/outbox';
import { getConnection } from '../../../infrastructure/database/connection';
import { MongoUnitOfWork } from '../../../infrastructure/database/MongoUnitOfWork';
import { MongoFulfillmentRepository } from '../../../infrastructure/repositories/FulfillmentRepository';
import { FulfillmentModel } from '../../../infrastructure/database/models/FulfillmentModel';
import { InMemoryEventBus } from '../../../application/shared/events/InMemoryEventBus';
import { CreateFulfillment } from '../../../application/fulfillment/use-cases/CreateFulfillment';
import { OnOrderRequested } from '../../../application/fulfillment/event-handlers/OnOrderRequested';

const CONFIG: OutboxConfig = {
  pollIntervalMs: 2000,
  batchSize: 100,
  maxRetries: 5,
  backoffBaseMs: 1000,
  leaseMs: 60_000,
};

/** Dispatcher that records what the relay handed it. */
class RecordingDispatcher implements IOutboxDispatcher {
  readonly received: DomainEvent[] = [];
  async dispatch(event: DomainEvent): Promise<void> {
    this.received.push(event);
  }
}

/** Dispatcher that always rejects — exercises the processor's failure path,
 *  which the old bus-based relay could never reach (InMemoryEventBus swallows
 *  handler errors, so every row settled PROCESSED). */
class ThrowingDispatcher implements IOutboxDispatcher {
  async dispatch(): Promise<void> {
    throw new Error('dispatch failed');
  }
}

function seedRow(overrides: Partial<Record<string, unknown>> = {}) {
  const eventId = randomUUID();
  return {
    eventId,
    eventName: 'UserRegistered',
    aggregateId: randomUUID(),
    aggregateType: 'user',
    payload: { eventId, eventName: 'UserRegistered', aggregateId: 'a', occurredOn: new Date() },
    status: OUTBOX_STATUS.PENDING,
    retryCount: 0,
    createdAt: new Date(),
    processedAt: null,
    nextAttemptAt: new Date(),
    lastError: null,
    lockedAt: null,
    ...overrides,
  };
}

describe('OutboxProcessor (Phase 8, Batch 4)', () => {
  let txContext: TransactionContext;
  let repo: MongoOutboxRepository;

  beforeEach(() => {
    txContext = new TransactionContext();
    repo = new MongoOutboxRepository(txContext);
  });

  afterEach(async () => {
    await OutboxEventModel.deleteMany({});
  });

  it('dispatches a pending event and marks the row PROCESSED', async () => {
    const dispatcher = new RecordingDispatcher();
    const doc = await OutboxEventModel.create(seedRow());

    const processor = new OutboxProcessor(repo, dispatcher, CONFIG);
    await processor.processBatch();

    expect(dispatcher.received).toHaveLength(1);
    expect(dispatcher.received[0].eventName).toBe('UserRegistered');
    const updated = await OutboxEventModel.findById(doc._id).lean();
    expect(updated!.status).toBe(OUTBOX_STATUS.PROCESSED);
    expect(updated!.processedAt).toBeInstanceOf(Date);
  });

  it('honors the nextAttemptAt gate — future-scheduled rows are skipped', async () => {
    const dispatcher = new RecordingDispatcher();
    const future = new Date(Date.now() + 60_000);
    const doc = await OutboxEventModel.create(seedRow({ nextAttemptAt: future }));

    const processor = new OutboxProcessor(repo, dispatcher, CONFIG);
    await processor.processBatch();

    expect(dispatcher.received).toHaveLength(0);
    const updated = await OutboxEventModel.findById(doc._id).lean();
    expect(updated!.status).toBe(OUTBOX_STATUS.PENDING);
  });

  it('on transient failure returns the row to PENDING with retryCount++, backoff and lastError', async () => {
    const dispatcher = new ThrowingDispatcher();
    const doc = await OutboxEventModel.create(seedRow({ retryCount: 0 }));

    const before = Date.now();
    const processor = new OutboxProcessor(repo, dispatcher, CONFIG);
    await processor.processBatch();
    const after = Date.now();

    const updated = await OutboxEventModel.findById(doc._id).lean();
    expect(updated!.status).toBe(OUTBOX_STATUS.PENDING);
    expect(updated!.retryCount).toBe(1);
    expect(updated!.lastError).toContain('dispatch failed');
    const lowerBound = before + CONFIG.backoffBaseMs;
    expect(updated!.nextAttemptAt!.getTime()).toBeGreaterThanOrEqual(lowerBound);
    expect(updated!.nextAttemptAt!.getTime()).toBeLessThan(after + CONFIG.backoffBaseMs * 3);
  });

  it('escalates to terminal FAILED on the 5th failure and never re-serves it', async () => {
    const dispatcher = new ThrowingDispatcher();
    const doc = await OutboxEventModel.create(seedRow({ retryCount: 4 }));

    const processor = new OutboxProcessor(repo, dispatcher, CONFIG);
    await processor.processBatch();

    const updated = await OutboxEventModel.findById(doc._id).lean();
    expect(updated!.status).toBe(OUTBOX_STATUS.FAILED);
    expect(updated!.lastError).toContain('dispatch failed');

    const pending = await repo.findPending(100);
    expect(pending.find((r) => String(r._id) === String(doc._id))).toBeUndefined();
  });

  it('claim CAS prevents a second claim of the same row', async () => {
    const doc = await OutboxEventModel.create(seedRow());
    const id = String(doc._id);

    await expect(repo.claim(id)).resolves.toBe(true);
    await expect(repo.claim(id)).resolves.toBe(false);

    const updated = await OutboxEventModel.findById(id).lean();
    expect(updated!.status).toBe(OUTBOX_STATUS.PROCESSING);
    expect(updated!.lockedAt).toBeInstanceOf(Date);
  });

  it('skips a row already PROCESSING under a fresh lease', async () => {
    const dispatcher = new RecordingDispatcher();
    const doc = await OutboxEventModel.create(
      seedRow({ status: OUTBOX_STATUS.PROCESSING, lockedAt: new Date() }),
    );

    const processor = new OutboxProcessor(repo, dispatcher, CONFIG);
    await processor.processBatch();

    expect(dispatcher.received).toHaveLength(0);
    const updated = await OutboxEventModel.findById(doc._id).lean();
    expect(updated!.status).toBe(OUTBOX_STATUS.PROCESSING);
  });

  it('reclaims a PROCESSING row whose lease expired and then processes it', async () => {
    const dispatcher = new RecordingDispatcher();
    const stale = new Date(Date.now() - CONFIG.leaseMs - 1000);
    const doc = await OutboxEventModel.create(
      seedRow({ status: OUTBOX_STATUS.PROCESSING, lockedAt: stale }),
    );

    const processor = new OutboxProcessor(repo, dispatcher, CONFIG);
    await processor.processBatch();

    expect(dispatcher.received).toHaveLength(1);
    const updated = await OutboxEventModel.findById(doc._id).lean();
    expect(updated!.status).toBe(OUTBOX_STATUS.PROCESSED);
    expect(updated!.lockedAt).toBeNull();
  });

  it('does not dispatch a row a concurrent writer claimed between findPending and claim', async () => {
    const dispatcher = new RecordingDispatcher();
    const doc = await OutboxEventModel.create(seedRow());

    const processor = new OutboxProcessor(repo, dispatcher, CONFIG);
    // Simulate the other relay winning the race: it claims the row after we
    // read it as PENDING but before we get to claim it ourselves.
    const originalFindPending = repo.findPending.bind(repo);
    jest.spyOn(repo, 'findPending').mockImplementation(async (limit?: number) => {
      const rows = await originalFindPending(limit);
      await repo.claim(String(doc._id));
      return rows;
    });

    await processor.processBatch();

    expect(dispatcher.received).toHaveLength(0);
    const updated = await OutboxEventModel.findById(doc._id).lean();
    expect(updated!.status).toBe(OUTBOX_STATUS.PROCESSING);
  });

  it('settles an unrouted event name as a no-op without running any handler', async () => {
    const identityHandler = jest.fn();
    const dispatcher = new OutboxDispatcher({
      OrderRequested: async () => {
        identityHandler();
      },
    });
    const doc = await OutboxEventModel.create(seedRow({ eventName: 'UserRegistered' }));

    const processor = new OutboxProcessor(repo, dispatcher, CONFIG);
    await processor.processBatch();

    expect(identityHandler).not.toHaveBeenCalled();
    const updated = await OutboxEventModel.findById(doc._id).lean();
    expect(updated!.status).toBe(OUTBOX_STATUS.PROCESSED);
    expect(updated!.lastError).toBeNull();
  });
});

/**
 * The relay's one real route. Batch 3 makes this the *only* path to a
 * fulfillment, so at-least-once delivery must be provably idempotent here.
 */
describe('OutboxProcessor → OrderRequested route (Phase 7, Batch 2)', () => {
  const RESTAURANT_ID = 'relay-rest-1';
  const CUSTOMER_ID = 'relay-cust-1';

  let txContext: TransactionContext;
  let repo: MongoOutboxRepository;
  let processor: OutboxProcessor;

  function orderRequestedRow(orderRequestId: string) {
    const eventId = randomUUID();
    return seedRow({
      eventId,
      eventName: 'OrderRequested',
      aggregateId: orderRequestId,
      aggregateType: 'order_request',
      payload: {
        eventId,
        eventName: 'OrderRequested',
        aggregateId: orderRequestId,
        occurredOn: new Date(),
        customerId: CUSTOMER_ID,
        restaurantId: RESTAURANT_ID,
        lines: [
          {
            menuItemId: 'i1',
            name: 'Paneer Tikka',
            quantity: 1,
            selectedOptions: [],
            lineTotal: { amount: 40000, currency: 'INR' },
          },
        ],
        pricing: { total: { amount: 45000, currency: 'INR' } },
        deliveryAddress: {
          street: '12 MG Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pinCode: '560001',
          coordinates: { lat: 12.97, lng: 77.59 },
        },
      },
    });
  }

  beforeAll(() => {
    txContext = new TransactionContext();
    repo = new MongoOutboxRepository(txContext);

    const createFulfillment = new CreateFulfillment(
      new MongoFulfillmentRepository(txContext),
      new MongoUnitOfWork(getConnection(), txContext),
      new InMemoryEventBus(),
    );
    const onOrderRequested = new OnOrderRequested(createFulfillment);
    processor = new OutboxProcessor(
      repo,
      new OutboxDispatcher({ OrderRequested: (e) => onOrderRequested.handle(e) }),
      CONFIG,
    );
  });

  afterEach(async () => {
    await Promise.all([FulfillmentModel.deleteMany({}), OutboxEventModel.deleteMany({})]);
  });

  it('creates exactly one fulfillment from an OrderRequested row', async () => {
    const orderRequestId = randomUUID();
    const doc = await OutboxEventModel.create(orderRequestedRow(orderRequestId));

    await processor.processBatch();

    expect(await FulfillmentModel.countDocuments({ orderRequestId })).toBe(1);
    const updated = await OutboxEventModel.findById(doc._id).lean();
    expect(updated!.status).toBe(OUTBOX_STATUS.PROCESSED);
  });

  it('is idempotent — re-delivering the same row still yields exactly one fulfillment', async () => {
    const orderRequestId = randomUUID();
    const doc = await OutboxEventModel.create(orderRequestedRow(orderRequestId));

    await processor.processBatch();
    // Re-arm the row as if the relay crashed after dispatch but before settling.
    await OutboxEventModel.updateOne(
      { _id: doc._id },
      { $set: { status: OUTBOX_STATUS.PENDING, lockedAt: null, processedAt: null } },
    );
    await processor.processBatch();

    expect(await FulfillmentModel.countDocuments({ orderRequestId })).toBe(1);
    const updated = await OutboxEventModel.findById(doc._id).lean();
    expect(updated!.status).toBe(OUTBOX_STATUS.PROCESSED);
  });
});
