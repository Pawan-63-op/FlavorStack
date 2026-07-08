import { randomUUID } from 'crypto';
import { getConnection } from '../../../infrastructure/database/connection';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUnitOfWork } from '../../../infrastructure/database/MongoUnitOfWork';
import { MongoOutboxStore } from '../../../infrastructure/database/MongoOutboxStore';
import { MongoOutboxRepository } from '../../../infrastructure/repositories/OutboxRepository';
import { MongoUserRepository } from '../../../infrastructure/repositories/UserRepository';
import {
  OutboxEventModel,
  OUTBOX_STATUS,
} from '../../../infrastructure/database/models/OutboxEventModel';
import { UserModel } from '../../../infrastructure/database/models/UserModel';
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { buildCustomer } from './identity-fixtures';

function makeEvent(aggregateId: string, eventName = 'UserRegistered'): DomainEvent {
  return {
    eventId: randomUUID(),
    occurredOn: new Date(),
    eventName,
    aggregateId,
  };
}

describe('Outbox persistence (Batch 6)', () => {
  let txContext: TransactionContext;
  let uow: MongoUnitOfWork;
  let store: MongoOutboxStore;
  let repo: MongoOutboxRepository;
  let userRepo: MongoUserRepository;

  beforeEach(() => {
    txContext = new TransactionContext();
    uow = new MongoUnitOfWork(getConnection(), txContext);
    store = new MongoOutboxStore(txContext);
    repo = new MongoOutboxRepository(txContext);
    userRepo = new MongoUserRepository(txContext);
  });

  afterEach(async () => {
    await OutboxEventModel.deleteMany({});
    await UserModel.deleteMany({});
  });

  describe('MongoOutboxStore.append', () => {
    it('persists one PENDING row per event with serialized payload', async () => {
      const aggId = randomUUID();
      const events = [makeEvent(aggId, 'UserRegistered'), makeEvent(aggId, 'EmailVerified')];

      await store.append(events, undefined);

      const rows = await OutboxEventModel.find({}).sort({ eventName: 1 }).lean();
      expect(rows).toHaveLength(2);
      const reg = rows.find((r) => r.eventName === 'UserRegistered')!;
      expect(reg.eventId).toBe(events[0].eventId);
      expect(reg.aggregateId).toBe(aggId);
      expect(reg.aggregateType).toBe('user');
      expect(reg.status).toBe(OUTBOX_STATUS.PENDING);
      expect(reg.retryCount).toBe(0);
      expect(reg.processedAt).toBeNull();
      expect(reg.payload).toMatchObject({ eventId: events[0].eventId, eventName: 'UserRegistered' });
    });

    it('is idempotent on eventId — re-appending the same event does not duplicate or throw', async () => {
      const event = makeEvent(randomUUID());

      await store.append([event], undefined);
      await expect(store.append([event], undefined)).resolves.toBeUndefined();

      const rows = await OutboxEventModel.find({ eventId: event.eventId }).lean();
      expect(rows).toHaveLength(1);
    });

    it('writes nothing when given an empty event list', async () => {
      await store.append([], undefined);
      expect(await OutboxEventModel.countDocuments({})).toBe(0);
    });
  });

  describe('atomic aggregate save + outbox append', () => {
    it('commits the user and the outbox rows together', async () => {
      const customer = buildCustomer();
      const event = makeEvent(customer._id);

      await uow.runInTransaction(async (ctx) => {
        await userRepo.save(customer);
        await store.append([event], ctx);
      });

      const savedUser = await UserModel.findById(customer._id).lean();
      const rows = await OutboxEventModel.find({ aggregateId: customer._id }).lean();
      expect(savedUser).not.toBeNull();
      expect(rows).toHaveLength(1);
      expect(rows[0].eventId).toBe(event.eventId);
    });

    it('rolls back BOTH the user and the outbox rows when the work throws', async () => {
      const customer = buildCustomer();
      const event = makeEvent(customer._id);

      await expect(
        uow.runInTransaction(async (ctx) => {
          await userRepo.save(customer);
          await store.append([event], ctx);
          throw new Error('boom after append');
        }),
      ).rejects.toThrow('boom after append');

      expect(await UserModel.findById(customer._id).lean()).toBeNull();
      expect(await OutboxEventModel.countDocuments({ aggregateId: customer._id })).toBe(0);
    });
  });

  describe('MongoOutboxRepository.save', () => {
    it('persists a single PENDING row for an event', async () => {
      const event = makeEvent(randomUUID());

      await repo.save(event);

      const row = await OutboxEventModel.findOne({ eventId: event.eventId }).lean();
      expect(row).not.toBeNull();
      expect(row!.status).toBe(OUTBOX_STATUS.PENDING);
      expect(row!.aggregateType).toBe('user');
    });
  });

  describe('MongoOutboxRepository.findPending', () => {
    it('returns only PENDING rows, oldest first, up to the limit', async () => {
      const base = Date.now();
      await OutboxEventModel.create([
        { eventId: 'e1', eventName: 'A', aggregateId: 'a', aggregateType: 'user', payload: {}, status: OUTBOX_STATUS.PENDING, retryCount: 0, createdAt: new Date(base + 100), processedAt: null },
        { eventId: 'e2', eventName: 'B', aggregateId: 'a', aggregateType: 'user', payload: {}, status: OUTBOX_STATUS.PENDING, retryCount: 0, createdAt: new Date(base + 200), processedAt: null },
        { eventId: 'e3', eventName: 'C', aggregateId: 'a', aggregateType: 'user', payload: {}, status: OUTBOX_STATUS.PROCESSED, retryCount: 0, createdAt: new Date(base + 50), processedAt: new Date() },
      ]);

      const pending = await repo.findPending(10);
      expect(pending.map((r) => r.eventId)).toEqual(['e1', 'e2']);

      const limited = await repo.findPending(1);
      expect(limited.map((r) => r.eventId)).toEqual(['e1']);
    });
  });

  describe('MongoOutboxRepository status transitions', () => {
    it('markProcessing transitions a PENDING row to PROCESSING', async () => {
      const event = makeEvent(randomUUID());
      await repo.save(event);
      const row = await OutboxEventModel.findOne({ eventId: event.eventId }).lean();

      await repo.markProcessing(String(row!._id));

      const updated = await OutboxEventModel.findById(row!._id).lean();
      expect(updated!.status).toBe(OUTBOX_STATUS.PROCESSING);
    });

    it('markProcessed sets PROCESSED status and a processedAt timestamp', async () => {
      const event = makeEvent(randomUUID());
      await repo.save(event);
      const row = await OutboxEventModel.findOne({ eventId: event.eventId }).lean();

      await repo.markProcessed(String(row!._id));

      const updated = await OutboxEventModel.findById(row!._id).lean();
      expect(updated!.status).toBe(OUTBOX_STATUS.PROCESSED);
      expect(updated!.processedAt).toBeInstanceOf(Date);
    });
  });
});
