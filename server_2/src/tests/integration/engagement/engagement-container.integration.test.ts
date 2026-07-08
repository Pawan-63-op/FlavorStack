import { getConnection } from '../../../infrastructure/database/connection';
import { InMemoryEventBus } from '../../../application/shared/events/InMemoryEventBus';
import { INotificationQueue } from '../../../application/shared/queues/INotificationQueue';
import { NotificationJob, EnqueueOptions } from '../../../application/shared/queues/jobs';
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { createEngagementContainer, EngagementContainer } from '../../../container/engagement.container';
import { seedNotificationTemplates } from '../../../infrastructure/database/seeds/notification-templates.seed';
import { OutboxProcessor } from '../../../infrastructure/outbox/OutboxProcessor';
import { MongoOutboxRepository } from '../../../infrastructure/repositories/OutboxRepository';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { getOutboxConfig } from '../../../config/outbox';

import { NotificationModel } from '../../../infrastructure/database/models/NotificationModel';
import { ReviewModel } from '../../../infrastructure/database/models/ReviewModel';
import { ReviewEligibilityModel } from '../../../infrastructure/database/models/ReviewEligibilityModel';
import { NotificationTemplateModel } from '../../../infrastructure/database/models/NotificationTemplateModel';
import { NotificationPreferenceModel } from '../../../infrastructure/database/models/NotificationPreferenceModel';
import { OutboxEventModel } from '../../../infrastructure/database/models/OutboxEventModel';

class FakeNotificationQueue implements INotificationQueue {
  public readonly jobs: { job: NotificationJob; opts?: EnqueueOptions }[] = [];
  async enqueue(job: NotificationJob, opts?: EnqueueOptions): Promise<void> {
    this.jobs.push({ job, opts });
  }
  async close(): Promise<void> {}
}

let id = 0;
const nextId = (prefix: string) => `${prefix}-${(id += 1)}`;

function fulfillmentCreatedEvent(args: {
  fulfillmentId: string;
  customerId: string;
  restaurantId: string;
}): DomainEvent & { customerId: string; restaurantId: string; total: { amount: number; currency: string } } {
  return {
    eventId: nextId('evt-fc'),
    eventName: 'FulfillmentCreated',
    aggregateId: args.fulfillmentId,
    occurredOn: new Date(),
    customerId: args.customerId,
    restaurantId: args.restaurantId,
    total: { amount: 2599, currency: 'INR' },
  };
}

function deliveryCompletedEvent(fulfillmentId: string, deliveredAt: Date): DomainEvent & { deliveredAt: string } {
  return {
    eventId: nextId('evt-dc'),
    eventName: 'DeliveryCompleted',
    aggregateId: fulfillmentId,
    occurredOn: new Date(),
    deliveredAt: deliveredAt.toISOString(),
  };
}

describe('Engagement container wiring (Phase 3.B)', () => {
  let eventBus: InMemoryEventBus;
  let queue: FakeNotificationQueue;
  let container: EngagementContainer;

  beforeEach(() => {
    eventBus = new InMemoryEventBus();
    queue = new FakeNotificationQueue();
    container = createEngagementContainer(getConnection(), eventBus, queue);
  });

  afterEach(async () => {
    await Promise.all([
      NotificationModel.deleteMany({}),
      ReviewModel.deleteMany({}),
      ReviewEligibilityModel.deleteMany({}),
      NotificationTemplateModel.deleteMany({}),
      NotificationPreferenceModel.deleteMany({}),
      OutboxEventModel.deleteMany({}),
    ]);
  });

  it('subscribes all nine cross-context handlers (registration validation)', () => {
    const probeBus = new InMemoryEventBus();
    const subscribeSpy = jest.spyOn(probeBus, 'subscribe');
    createEngagementContainer(getConnection(), probeBus, new FakeNotificationQueue());

    const subscribed = subscribeSpy.mock.calls.map((c) => c[0]);
    for (const name of [
      'UserRegistered',
      'PasswordChanged',
      'PasswordResetRequested',
      'FulfillmentCreated',
      'ReadyForPickup',
      'RiderAssigned',
      'OutForDelivery',
      'DeliveryCompleted',
      'FulfillmentCancelled',
    ]) {
      expect(subscribed).toContain(name);
    }
    expect(subscribed).toHaveLength(9);
  });

  describe('outbox-in-transaction (SubmitReview)', () => {
    const customerId = 'cust-1';
    const restaurantId = 'rest-1';
    const fulfillmentId = 'ful-1';

    beforeEach(async () => {
      await container.eligibilityRepository.upsert({
        fulfillmentId,
        customerId,
        restaurantId,
        deliveredAt: new Date(),
        reviewed: false,
      });
    });

    it('persists the Review aggregate AND its outbox row atomically', async () => {
      const result = await container.submitReview.execute({
        customerId,
        restaurantId,
        fulfillmentId,
        restaurantRating: 5,
        deliveryRating: 4,
        comment: 'Great food',
      });

      expect(result.isSuccess).toBe(true);

      const reviews = await ReviewModel.find({}).lean();
      expect(reviews).toHaveLength(1);
      expect(reviews[0].customerId).toBe(customerId);

      const outbox = await OutboxEventModel.find({ eventName: 'ReviewSubmitted' }).lean();
      expect(outbox).toHaveLength(1);
      expect(outbox[0].aggregateId).toBe(reviews[0]._id);

      const eligibility = await container.eligibilityRepository.findByFulfillmentId(fulfillmentId);
      expect(eligibility?.reviewed).toBe(true);
    });

    it('rolls back BOTH the aggregate and the outbox row when the transaction fails', async () => {
      const spy = jest
        .spyOn(container.outboxStore, 'append')
        .mockRejectedValueOnce(new Error('boom-inside-txn'));

      await expect(
        container.submitReview.execute({
          customerId,
          restaurantId,
          fulfillmentId,
          restaurantRating: 5,
          deliveryRating: 4,
          comment: 'Great food',
        })
      ).rejects.toThrow('boom-inside-txn');

      expect(await ReviewModel.countDocuments({})).toBe(0);
      expect(await OutboxEventModel.countDocuments({})).toBe(0);
      const eligibility = await container.eligibilityRepository.findByFulfillmentId(fulfillmentId);
      expect(eligibility?.reviewed).toBe(false);

      spy.mockRestore();
    });
  });

  describe('consumed-event → notification pipeline', () => {
    beforeEach(async () => {
      await seedNotificationTemplates(container.templateRepository);
    });

    it('FulfillmentCreated seeds ReviewEligibility and renders a PENDING order_confirmed notification', async () => {
      const fulfillmentId = nextId('ful');
      const customerId = nextId('cust');
      const restaurantId = nextId('rest');

      await eventBus.publish(fulfillmentCreatedEvent({ fulfillmentId, customerId, restaurantId }));

      const eligibility = await container.eligibilityRepository.findByFulfillmentId(fulfillmentId);
      expect(eligibility).not.toBeNull();
      expect(eligibility?.customerId).toBe(customerId);
      expect(eligibility?.restaurantId).toBe(restaurantId);
      expect(eligibility?.deliveredAt).toBeNull();
      expect(eligibility?.reviewed).toBe(false);

      const note = await NotificationModel.findOne({ recipientUserId: customerId }).lean();
      expect(note).not.toBeNull();
      expect(note?.status).toBe('PENDING');
      expect(note?.templateKey).toBe('order_confirmed');
      expect(note?.channel).toBe('PUSH');
      expect(note?.renderedBody).toContain(fulfillmentId);

      expect(queue.jobs).toHaveLength(1);
      expect(queue.jobs[0].job).toMatchObject({ type: 'engagement', channel: 'PUSH' });
    });

    it('DeliveryCompleted sets eligibility.deliveredAt and renders a PENDING delivered notification', async () => {
      const fulfillmentId = nextId('ful');
      const customerId = nextId('cust');
      const restaurantId = nextId('rest');

      await container.eligibilityRepository.upsert({
        fulfillmentId,
        customerId,
        restaurantId,
        deliveredAt: null,
        reviewed: false,
      });

      const deliveredAt = new Date('2026-06-17T10:00:00.000Z');
      await eventBus.publish(deliveryCompletedEvent(fulfillmentId, deliveredAt));

      const eligibility = await container.eligibilityRepository.findByFulfillmentId(fulfillmentId);
      expect(eligibility?.deliveredAt).not.toBeNull();
      expect(eligibility?.deliveredAt?.toISOString()).toBe(deliveredAt.toISOString());

      const note = await NotificationModel.findOne({
        recipientUserId: customerId,
        templateKey: 'delivered',
      }).lean();
      expect(note).not.toBeNull();
      expect(note?.status).toBe('PENDING');
      expect(note?.channel).toBe('PUSH');
    });
  });

  describe('outbox spine', () => {
    it('OutboxProcessor drains the publish-only ReviewSubmitted row to PROCESSED (no subscriber)', async () => {
      const customerId = nextId('cust');
      const restaurantId = nextId('rest');
      const fulfillmentId = nextId('ful');
      await container.eligibilityRepository.upsert({
        fulfillmentId,
        customerId,
        restaurantId,
        deliveredAt: new Date(),
        reviewed: false,
      });

      await container.submitReview.execute({
        customerId,
        restaurantId,
        fulfillmentId,
        restaurantRating: 5,
        deliveryRating: 4,
        comment: 'Tasty',
      });

      const processor = new OutboxProcessor(
        new MongoOutboxRepository(new TransactionContext()),
        new InMemoryEventBus(), // ReviewSubmitted has no subscriber → drains as PROCESSED gracefully
        getOutboxConfig()
      );
      await processor.processBatch();

      const row = await OutboxEventModel.findOne({ eventName: 'ReviewSubmitted' }).lean();
      expect(row?.status).toBe('PROCESSED');
    });
  });
});
