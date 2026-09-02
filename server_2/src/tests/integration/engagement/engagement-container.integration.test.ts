import { getConnection } from '../../../infrastructure/database/connection';
import { InMemoryEventBus } from '../../../application/shared/events/InMemoryEventBus';
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { createEngagementContainer, EngagementContainer } from '../../../container/engagement.container';
import { seedNotificationTemplates } from '../../../infrastructure/database/seeds/notification-templates.seed';
import { MongoFulfillmentQueryRepository } from '../../../infrastructure/repositories/FulfillmentQueryRepository';
import { FULFILLMENT_STATUS } from '../../../domain/fulfillment/enums/fulfillment-status.enum';
import { NOTIFICATION_CATEGORY } from '../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../domain/engagement/enums/notification-channel.enum';

import { NotificationModel } from '../../../infrastructure/database/models/NotificationModel';
import { ReviewModel } from '../../../infrastructure/database/models/ReviewModel';
import { FulfillmentModel } from '../../../infrastructure/database/models/FulfillmentModel';
import { NotificationTemplateModel } from '../../../infrastructure/database/models/NotificationTemplateModel';
import { NotificationPreferenceModel } from '../../../infrastructure/database/models/NotificationPreferenceModel';
import { OutboxEventModel } from '../../../infrastructure/database/models/OutboxEventModel';


let id = 0;
const nextId = (prefix: string) => `${prefix}-${(id += 1)}`;

/**
 * Review eligibility now comes from the `fulfillments` aggregate itself (Phase 4), so these
 * tests seed a real fulfillment row rather than a `review_eligibility` replica — which also
 * exercises MongoFulfillmentQueryRepository.findReviewSubject for real.
 */
async function seedFulfillment(args: {
  fulfillmentId: string;
  customerId: string;
  restaurantId: string;
  delivered: boolean;
  deliveredAt?: Date;
}): Promise<void> {
  const now = new Date();
  await FulfillmentModel.create({
    _id: args.fulfillmentId,
    orderRequestId: nextId('ord'),
    customerId: args.customerId,
    restaurantId: args.restaurantId,
    lines: [],
    deliveryAddress: {
      street: '1 Test St',
      city: 'Pune',
      state: 'MH',
      pinCode: '411001',
      coordinates: { lat: 18.52, lng: 73.85 },
    },
    pricingTotal: { amount: 2599, currency: 'INR' },
    fulfillmentStatus: args.delivered ? FULFILLMENT_STATUS.DELIVERED : FULFILLMENT_STATUS.CREATED,
    deliveryStatus: 'UNASSIGNED',
    createdAt: now,
    updatedAt: now,
    ...(args.delivered ? { deliveredAt: args.deliveredAt ?? now } : {}),
  });
}

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
  let container: EngagementContainer;

  beforeEach(() => {
    eventBus = new InMemoryEventBus();
    container = createEngagementContainer(
      getConnection(),
      eventBus,
      new MongoFulfillmentQueryRepository()
    );
  });

  afterEach(async () => {
    await Promise.all([
      NotificationModel.deleteMany({}),
      ReviewModel.deleteMany({}),
      FulfillmentModel.deleteMany({}),
      NotificationTemplateModel.deleteMany({}),
      NotificationPreferenceModel.deleteMany({}),
      OutboxEventModel.deleteMany({}),
    ]);
  });

  it('subscribes all nine cross-context handlers (registration validation)', () => {
    const probeBus = new InMemoryEventBus();
    const subscribeSpy = jest.spyOn(probeBus, 'subscribe');
    createEngagementContainer(
      getConnection(),
      probeBus,
      new MongoFulfillmentQueryRepository()
    );

    const subscribed = subscribeSpy.mock.calls.map((c) => c[0]);
    for (const name of [
      'UserRegistered',
      'FulfillmentCreated',
      'ReadyForPickup',
      'RiderAssigned',
      'OutForDelivery',
      'DeliveryCompleted',
      'FulfillmentCancelled',
    ]) {
      expect(subscribed).toContain(name);
    }
    expect(subscribed).toHaveLength(7);
  });

  describe('outbox-in-transaction (SubmitReview)', () => {
    const customerId = 'cust-1';
    const restaurantId = 'rest-1';
    const fulfillmentId = 'ful-1';

    beforeEach(async () => {
      await seedFulfillment({ fulfillmentId, customerId, restaurantId, delivered: true });
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

      // Phase 6: `Review` raises no domain events, so submission writes no outbox row.
      expect(await OutboxEventModel.countDocuments({})).toBe(0);
    });

    it('rejects a second review for the same (customer, fulfillment)', async () => {
      const dto = { customerId, restaurantId, fulfillmentId, restaurantRating: 5, comment: 'Great food' };

      expect((await container.submitReview.execute(dto)).isSuccess).toBe(true);
      // Dedupe is now the `reviews` unique index, not a replicated `reviewed` flag.
      expect((await container.submitReview.execute(dto)).isFailure).toBe(true);
      expect(await ReviewModel.countDocuments({})).toBe(1);
    });

    it('rolls back the aggregate when the transaction body throws', async () => {
      const spy = jest
        .spyOn(container.reviewRepository, 'save')
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

      spy.mockRestore();
    });
  });

  describe('consumed-event → notification pipeline', () => {
    beforeEach(async () => {
      await seedNotificationTemplates(container.templateRepository);
    });

    it('FulfillmentCreated renders a SENT order_confirmed notification (no read, no seed)', async () => {
      const fulfillmentId = nextId('ful');
      const customerId = nextId('cust');
      const restaurantId = nextId('rest');

      // Deliberately no fulfillment row: this handler takes the recipient off the event.
      await eventBus.publish(fulfillmentCreatedEvent({ fulfillmentId, customerId, restaurantId }));

      const note = await NotificationModel.findOne({ recipientUserId: customerId }).lean();
      expect(note).not.toBeNull();
      expect(note?.status).toBe('SENT');
      expect(note?.templateKey).toBe('order_confirmed');
      expect(note?.channel).toBe('INBOX');
      expect(note?.renderedBody).toContain(fulfillmentId);

      // Phase 5: INBOX is written synchronously — the Mongo row is the delivery.
      expect(note?.sentAt).toBeInstanceOf(Date);
      expect(note?.provider).toBeUndefined();
    });

    it('DeliveryCompleted resolves the customer off the fulfillment and renders a SENT delivered notification', async () => {
      const fulfillmentId = nextId('ful');
      const customerId = nextId('cust');
      const restaurantId = nextId('rest');

      const deliveredAt = new Date('2026-06-17T10:00:00.000Z');
      // The event carries no customerId — the gateway must resolve it from this row.
      await seedFulfillment({ fulfillmentId, customerId, restaurantId, delivered: true, deliveredAt });

      await eventBus.publish(deliveryCompletedEvent(fulfillmentId, deliveredAt));

      const note = await NotificationModel.findOne({
        recipientUserId: customerId,
        templateKey: 'delivered',
      }).lean();
      expect(note).not.toBeNull();
      expect(note?.status).toBe('SENT');
      expect(note?.channel).toBe('INBOX');
    });

    it('is idempotent: dispatching INBOX twice for one sourceEventId leaves exactly one SENT row', async () => {
      const customerId = nextId('cust');
      const sourceEventId = nextId('evt');
      const dto = {
        recipientUserId: customerId,
        category: NOTIFICATION_CATEGORY.ORDER_UPDATES,
        channel: NOTIFICATION_CHANNEL.INBOX,
        templateKey: 'order_confirmed',
        vars: { fulfillmentId: 'ful-dedupe' },
        sourceEventId,
      };

      const first = await container.dispatchNotification.execute(dto);
      const second = await container.dispatchNotification.execute(dto);

      expect(first.getValue().outcome).toBe('DISPATCHED');
      expect(second.getValue().outcome).toBe('SKIPPED');
      expect(second.getValue().reason).toBe('duplicate');

      const rows = await NotificationModel.find({ recipientUserId: customerId }).lean();
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('SENT');
      expect(rows[0].channel).toBe('INBOX');
    });
  });

  // The 'outbox spine' case that lived here drained a publish-only `ReviewSubmitted` row with no
  // subscriber. Phase 6 deleted that event outright — engagement no longer produces outbox rows,
  // and the relay is exercised by the commerce checkout suites.
});
