import { randomUUID } from 'crypto';

import { DispatchNotification } from '../../../application/engagement/use-cases/DispatchNotification';
import { DispatchNotificationDto } from '../../../application/engagement/dtos/DispatchNotificationDto';
import { buildDedupeKey, dedupeKeyToJobId } from '../../../application/engagement/use-cases/DedupeKeyBuilder';
import { NOTIFICATION_CATEGORY } from '../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../domain/engagement/enums/notification-channel.enum';
import { NotificationTemplate } from '../../../domain/engagement/entities/NotificationTemplate';
import { INotificationPreferenceRepository } from '../../../domain/engagement/repositories/INotificationPreferenceRepository';
import { INotificationTemplateRepository } from '../../../domain/engagement/repositories/INotificationTemplateRepository';
import { ConflictError } from '../../../domain/shared/errors/ConflictError';
import { DomainEvent } from '../../../domain/shared/DomainEvent';

import { IEventBus } from '../../../application/shared/events/IEventBus';
import { INotificationQueue } from '../../../application/shared/queues/INotificationQueue';
import { NotificationJob, EnqueueOptions } from '../../../application/shared/queues/jobs';

import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUnitOfWork } from '../../../infrastructure/database/MongoUnitOfWork';
import { MongoOutboxStore } from '../../../infrastructure/database/MongoOutboxStore';
import { MongoNotificationRepository } from '../../../infrastructure/repositories/NotificationRepository';
import { NotificationModel } from '../../../infrastructure/database/models/NotificationModel';
import { OutboxEventModel } from '../../../infrastructure/database/models/OutboxEventModel';
import { getConnection } from '../../../infrastructure/database/connection';

const allowAllPreferences: INotificationPreferenceRepository = {
  save: async () => undefined,
  findByUserId: async () => null, // → use case falls back to NotificationPreference.createDefault (default-allow)
};

function templateRepoReturning(): INotificationTemplateRepository {
  const tmpl = {
    active: true,
    render: () => ({ title: 'Order confirmed', body: 'Your order is confirmed' }),
  } as unknown as NotificationTemplate;
  return {
    save: async () => undefined,
    findByKeyChannelLocale: async () => tmpl,
  };
}

function capturingEventBus(): { bus: IEventBus; published: DomainEvent[] } {
  const published: DomainEvent[] = [];
  return {
    published,
    bus: {
      subscribe: () => undefined,
      publish: async (e) => {
        published.push(e);
      },
      publishAll: async (events) => {
        published.push(...events);
      },
    },
  };
}

function capturingQueue(): { queue: INotificationQueue; enqueued: Array<{ job: NotificationJob; jobId?: string }> } {
  const enqueued: Array<{ job: NotificationJob; jobId?: string }> = [];
  return {
    enqueued,
    queue: {
      enqueue: async (job: NotificationJob, opts?: EnqueueOptions) => {
        enqueued.push({ job, jobId: opts?.jobId });
      },
      close: async () => undefined,
    },
  };
}

describe('DispatchNotification — create-side dedup under contention (concurrency)', () => {
  let txContext: TransactionContext;
  let repo: MongoNotificationRepository;
  let outboxStore: MongoOutboxStore;
  let unitOfWork: MongoUnitOfWork;

  beforeAll(async () => {
    await NotificationModel.createIndexes();
  });

  beforeEach(() => {
    txContext = new TransactionContext();
    repo = new MongoNotificationRepository(txContext);
    outboxStore = new MongoOutboxStore(txContext);
    unitOfWork = new MongoUnitOfWork(getConnection(), txContext);
  });

  afterEach(async () => {
    await Promise.all([NotificationModel.deleteMany({}), OutboxEventModel.deleteMany({})]);
  });

  function newDispatch(bus: IEventBus, queue: INotificationQueue): DispatchNotification {
    return new DispatchNotification(repo, allowAllPreferences, templateRepoReturning(), unitOfWork, outboxStore, bus, queue);
  }

  function dto(sourceEventId: string): DispatchNotificationDto {
    return {
      recipientUserId: 'user-1',
      category: NOTIFICATION_CATEGORY.ORDER_UPDATES,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      templateKey: 'order_confirmed',
      sourceEventId,
    };
  }

  it('N concurrent dispatches for the SAME source event create exactly one notification + one enqueue', async () => {
    const sourceEventId = `evt-${randomUUID()}`;
    const dedupeKey = buildDedupeKey(sourceEventId, NOTIFICATION_CATEGORY.ORDER_UPDATES);
    const expectedJobId = dedupeKeyToJobId(dedupeKey);

    const eventBus = capturingEventBus();
    const queue = capturingQueue();

    const FANOUT = 5;
    const settled = await Promise.allSettled(
      Array.from({ length: FANOUT }, () => newDispatch(eventBus.bus, queue.queue).execute(dto(sourceEventId)))
    );

    expect(await NotificationModel.countDocuments({})).toBe(1);
    const row = await NotificationModel.findOne({ dedupeKey }).lean();
    expect(row).not.toBeNull();
    const notificationId = String(row!._id);

    expect(queue.enqueued).toHaveLength(1);
    expect(queue.enqueued[0].jobId).toBe(expectedJobId);
    expect(queue.enqueued[0].job).toMatchObject({ type: 'engagement', notificationId });

    const fulfilled = settled.filter(
      (s): s is PromiseFulfilledResult<Awaited<ReturnType<DispatchNotification['execute']>>> => s.status === 'fulfilled'
    );
    let dispatched = 0;
    for (const s of fulfilled) {
      expect(s.value.isSuccess).toBe(true);
      const res = s.value.getValue();
      if (res.outcome === 'DISPATCHED') {
        dispatched += 1;
        expect(res.notificationId).toBe(notificationId);
      } else {
        expect(res.outcome).toBe('SKIPPED');
        expect(res.reason).toBe('duplicate');
      }
      expect(res.dedupeKey).toBe(dedupeKey);
    }
    expect(dispatched).toBe(1); // exactly one caller actually created + enqueued

    const rejected = settled.filter((s): s is PromiseRejectedResult => s.status === 'rejected');
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(ConflictError);
    }

    const outboxForNotification = await OutboxEventModel.countDocuments({ aggregateId: notificationId });
    expect(await OutboxEventModel.countDocuments({})).toBe(outboxForNotification);
  });
});
