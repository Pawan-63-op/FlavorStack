import { randomUUID } from 'crypto';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoOutboxRepository } from '../../../infrastructure/repositories/OutboxRepository';
import {
  OutboxEventModel,
  OUTBOX_STATUS,
} from '../../../infrastructure/database/models/OutboxEventModel';
import { InMemoryEventBus } from '../../../application/shared/events/InMemoryEventBus';
import { IEventBus } from '../../../application/shared/events/IEventBus';
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { OutboxProcessor } from '../../../infrastructure/outbox/OutboxProcessor';
import { OutboxConfig } from '../../../config/outbox';

const CONFIG: OutboxConfig = {
  pollIntervalMs: 2000,
  batchSize: 100,
  maxRetries: 5,
  backoffBaseMs: 1000,
};

/** Bus whose publish always rejects — exercises the processor's failure path
 *  (the real InMemoryEventBus swallows handler errors, see plan §9). */
class ThrowingEventBus implements IEventBus {
  subscribe(): void {}
  async publish(): Promise<void> {
    throw new Error('publish failed');
  }
  async publishAll(): Promise<void> {
    throw new Error('publishAll failed');
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

  it('publishes a pending event to the bus and marks the row PROCESSED', async () => {
    const bus = new InMemoryEventBus();
    const received: DomainEvent[] = [];
    bus.subscribe('UserRegistered', async (e) => {
      received.push(e);
    });
    const doc = await OutboxEventModel.create(seedRow());

    const processor = new OutboxProcessor(repo, bus, CONFIG);
    await processor.processBatch();

    expect(received).toHaveLength(1);
    expect(received[0].eventName).toBe('UserRegistered');
    const updated = await OutboxEventModel.findById(doc._id).lean();
    expect(updated!.status).toBe(OUTBOX_STATUS.PROCESSED);
    expect(updated!.processedAt).toBeInstanceOf(Date);
  });

  it('honors the nextAttemptAt gate — future-scheduled rows are skipped', async () => {
    const bus = new InMemoryEventBus();
    const received: DomainEvent[] = [];
    bus.subscribe('UserRegistered', async (e) => {
      received.push(e);
    });
    const future = new Date(Date.now() + 60_000);
    const doc = await OutboxEventModel.create(seedRow({ nextAttemptAt: future }));

    const processor = new OutboxProcessor(repo, bus, CONFIG);
    await processor.processBatch();

    expect(received).toHaveLength(0);
    const updated = await OutboxEventModel.findById(doc._id).lean();
    expect(updated!.status).toBe(OUTBOX_STATUS.PENDING);
  });

  it('on transient failure returns the row to PENDING with retryCount++, backoff and lastError', async () => {
    const bus = new ThrowingEventBus();
    const doc = await OutboxEventModel.create(seedRow({ retryCount: 0 }));

    const before = Date.now();
    const processor = new OutboxProcessor(repo, bus, CONFIG);
    await processor.processBatch();
    const after = Date.now();

    const updated = await OutboxEventModel.findById(doc._id).lean();
    expect(updated!.status).toBe(OUTBOX_STATUS.PENDING);
    expect(updated!.retryCount).toBe(1);
    expect(updated!.lastError).toContain('publish failed');
    const lowerBound = before + CONFIG.backoffBaseMs;
    expect(updated!.nextAttemptAt!.getTime()).toBeGreaterThanOrEqual(lowerBound);
    expect(updated!.nextAttemptAt!.getTime()).toBeLessThan(after + CONFIG.backoffBaseMs * 3);
  });

  it('escalates to terminal FAILED on the 5th failure and never re-serves it', async () => {
    const bus = new ThrowingEventBus();
    const doc = await OutboxEventModel.create(seedRow({ retryCount: 4 }));

    const processor = new OutboxProcessor(repo, bus, CONFIG);
    await processor.processBatch();

    const updated = await OutboxEventModel.findById(doc._id).lean();
    expect(updated!.status).toBe(OUTBOX_STATUS.FAILED);
    expect(updated!.lastError).toContain('publish failed');

    const pending = await repo.findPending(100);
    expect(pending.find((r) => String(r._id) === String(doc._id))).toBeUndefined();
  });

  it('markProcessing CAS prevents a second claim of the same row', async () => {
    const doc = await OutboxEventModel.create(seedRow());
    const id = String(doc._id);

    await repo.markProcessing(id);
    await repo.markProcessing(id);

    const updated = await OutboxEventModel.findById(id).lean();
    expect(updated!.status).toBe(OUTBOX_STATUS.PROCESSING);
  });
});
