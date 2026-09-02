import { getConnection } from '../../../infrastructure/database/connection';
import { InMemoryEventBus } from '../../../application/shared/events/InMemoryEventBus';
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { createEngagementContainer, EngagementContainer } from '../../../container/engagement.container';
import { seedNotificationTemplates } from '../../../infrastructure/database/seeds/notification-templates.seed';
import { NotificationPreference } from '../../../domain/engagement/entities/NotificationPreference';
import { NOTIFICATION_CATEGORY } from '../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../domain/engagement/enums/notification-channel.enum';
import { MongoFulfillmentQueryRepository } from '../../../infrastructure/repositories/FulfillmentQueryRepository';
import { FULFILLMENT_STATUS } from '../../../domain/fulfillment/enums/fulfillment-status.enum';

import { NotificationModel } from '../../../infrastructure/database/models/NotificationModel';
import { ReviewModel } from '../../../infrastructure/database/models/ReviewModel';
import { NotificationTemplateModel } from '../../../infrastructure/database/models/NotificationTemplateModel';
import { NotificationPreferenceModel } from '../../../infrastructure/database/models/NotificationPreferenceModel';
import { FulfillmentModel } from '../../../infrastructure/database/models/FulfillmentModel';
import { OutboxEventModel } from '../../../infrastructure/database/models/OutboxEventModel';


let seq = 0;
const nextId = (prefix: string) => `${prefix}-${(seq += 1)}`;

/**
 * Phase 4: Engagement reads the `fulfillments` aggregate through IFulfillmentGateway
 * instead of keeping a `review_eligibility` copy, so these chains seed a real fulfillment.
 */
async function seedFulfillment(args: {
  fulfillmentId: string;
  customerId: string;
  restaurantId: string;
  delivered?: boolean;
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

function busEvent(eventName: string, aggregateId: string, payload: Record<string, unknown> = {}): DomainEvent {
  return {
    eventId: nextId('evt'),
    eventName,
    aggregateId,
    occurredOn: new Date(),
    ...payload,
  } as unknown as DomainEvent;
}

describe('Engagement cross-context E2E chains (Phase 6.A)', () => {
  let eventBus: InMemoryEventBus;
  let container: EngagementContainer;

  beforeAll(async () => {
    await Promise.all([
      NotificationModel.init(),
      ReviewModel.init(),
      NotificationTemplateModel.init(),
      NotificationPreferenceModel.init(),
      FulfillmentModel.init(),
    ]);
  });

  beforeEach(async () => {
    eventBus = new InMemoryEventBus();
    container = createEngagementContainer(
      getConnection(),
      eventBus,
      new MongoFulfillmentQueryRepository()
    );
    await seedNotificationTemplates(container.templateRepository);
  });

  afterEach(async () => {
    await Promise.all([
      NotificationModel.deleteMany({}),
      ReviewModel.deleteMany({}),
      NotificationTemplateModel.deleteMany({}),
      NotificationPreferenceModel.deleteMany({}),
      FulfillmentModel.deleteMany({}),
      OutboxEventModel.deleteMany({}),
    ]);
  });

  describe('UserRegistered → default preferences', () => {
    // Phase 5 Batch 3: Engagement only seeds preferences here. The welcome *email* is sent by
    // Identity's own `OnUserRegistered`, so no `notifications` row appears.
    it('seeds a default NotificationPreference and writes no notification', async () => {
      const userId = nextId('user');

      await eventBus.publish(
        busEvent('UserRegistered', userId, { email: 'jane@example.com', role: 'customer', name: 'Jane' })
      );

      const pref = await container.preferenceRepository.findByUserId(userId);
      expect(pref).not.toBeNull();
      expect(pref?.userId).toBe(userId);

      expect(await NotificationModel.countDocuments({ recipientUserId: userId })).toBe(0);
    });
  });

  describe('marquee chain: created → delivered → submit → approve → rating', () => {
    it('aggregates the rating from approved reviews across two fulfillments', async () => {
      const restaurantId = nextId('rest');
      const customerA = nextId('cust');
      const customerB = nextId('cust');
      const fulfillmentA = nextId('ful');
      const fulfillmentB = nextId('ful');

      const deliveredAt = new Date('2026-06-17T10:00:00.000Z');
      for (const [fulfillmentId, customerId] of [
        [fulfillmentA, customerA],
        [fulfillmentB, customerB],
      ]) {
        await seedFulfillment({ fulfillmentId, customerId, restaurantId, delivered: true, deliveredAt });
        await eventBus.publish(
          busEvent('FulfillmentCreated', fulfillmentId, {
            customerId,
            restaurantId,
            total: { amount: 2599, currency: 'INR' },
          })
        );
      }

      for (const fulfillmentId of [fulfillmentA, fulfillmentB]) {
        await eventBus.publish(busEvent('DeliveryCompleted', fulfillmentId, { deliveredAt: deliveredAt.toISOString() }));
      }
      const deliveredNote = await NotificationModel.findOne({ recipientUserId: customerA, templateKey: 'delivered' }).lean();
      expect(deliveredNote?.status).toBe('SENT');

      const submitA = await container.submitReview.execute({
        customerId: customerA,
        restaurantId,
        fulfillmentId: fulfillmentA,
        restaurantRating: 5,
        deliveryRating: 5,
        comment: 'Excellent',
      });
      const submitB = await container.submitReview.execute({
        customerId: customerB,
        restaurantId,
        fulfillmentId: fulfillmentB,
        restaurantRating: 3,
        deliveryRating: 4,
        comment: 'Fine',
      });
      expect(submitA.isSuccess).toBe(true);
      expect(submitB.isSuccess).toBe(true);

      // PENDING reviews do not count yet — the aggregation filters on APPROVED.
      expect((await container.getRestaurantRating.execute({ restaurantId })).getValue().reviewCount).toBe(0);

      const approveA = await container.moderateReview.execute({
        moderatorId: 'mod-1',
        reviewId: submitA.getValue().reviewId,
        action: 'APPROVE',
      });
      const approveB = await container.moderateReview.execute({
        moderatorId: 'mod-1',
        reviewId: submitB.getValue().reviewId,
        action: 'APPROVE',
      });
      expect(approveA.isSuccess).toBe(true);
      expect(approveB.isSuccess).toBe(true);

      const ratingResp = await container.getRestaurantRating.execute({ restaurantId });
      expect(ratingResp.isSuccess).toBe(true);
      const rating = ratingResp.getValue();
      expect(rating.reviewCount).toBe(2);
      expect(rating.avgRating).toBeCloseTo(4, 2); // (5 + 3) / 2
      expect(rating.distribution).toEqual({ 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 });
    });

    it('a rejected review does NOT contribute to the rating', async () => {
      const restaurantId = nextId('rest');
      const customerId = nextId('cust');
      const fulfillmentId = nextId('ful');

      await seedFulfillment({ fulfillmentId, customerId, restaurantId, delivered: true });
      await eventBus.publish(
        busEvent('FulfillmentCreated', fulfillmentId, {
          customerId,
          restaurantId,
          total: { amount: 1000, currency: 'INR' },
        })
      );
      await eventBus.publish(
        busEvent('DeliveryCompleted', fulfillmentId, { deliveredAt: new Date().toISOString() })
      );

      const submit = await container.submitReview.execute({
        customerId,
        restaurantId,
        fulfillmentId,
        restaurantRating: 1,
        comment: 'Bad',
      });
      const reject = await container.moderateReview.execute({
        moderatorId: 'mod-1',
        reviewId: submit.getValue().reviewId,
        action: 'REJECT',
        reason: 'abusive',
      });
      expect(reject.isSuccess).toBe(true);

      const rating = (await container.getRestaurantRating.execute({ restaurantId })).getValue();
      expect(rating.reviewCount).toBe(0);
      expect(rating.avgRating).toBe(0);
    });
  });

  describe('status-notification chains (recipient resolved via the fulfillment gateway)', () => {
    const restaurantId = 'rest-status';
    let fulfillmentId: string;
    let customerId: string;

    beforeEach(async () => {
      fulfillmentId = nextId('ful');
      customerId = nextId('cust');
      await seedFulfillment({ fulfillmentId, customerId, restaurantId });
    });

    it.each([
      ['ReadyForPickup', { readyAt: new Date() }, 'ready_for_pickup', 'ORDER_UPDATES', 'INBOX'],
      ['RiderAssigned', { riderId: 'r-1', assignedAt: new Date() }, 'rider_assigned', 'DELIVERY', 'INBOX'],
      ['OutForDelivery', { riderId: 'r-1' }, 'out_for_delivery', 'DELIVERY', 'INBOX'],
      ['FulfillmentCancelled', { reason: 'restaurant_closed' }, 'order_cancelled', 'ORDER_UPDATES', 'INBOX'],
    ])('%s → a SENT %s notification to the resolved customer', async (eventName, payload, templateKey, category, channel) => {
      await eventBus.publish(busEvent(eventName, fulfillmentId, payload));

      const note = await NotificationModel.findOne({ recipientUserId: customerId, templateKey }).lean();
      expect(note).not.toBeNull();
      // Phase 5: INBOX is delivered synchronously — the Mongo row is born SENT.
      expect(note?.status).toBe('SENT');
      expect(note?.sentAt).toBeInstanceOf(Date);
      expect(note?.provider).toBeUndefined();
      expect(note?.category).toBe(category);
      expect(note?.channel).toBe(channel);
    });
  });

  describe('preference suppression', () => {
    it('a disabled channel suppresses the dispatch (no notification row)', async () => {
      const restaurantId = nextId('rest');
      const customerId = nextId('cust');
      const fulfillmentId = nextId('ful');

      const pref = NotificationPreference.createDefault(customerId);
      pref.setChannel(NOTIFICATION_CATEGORY.ORDER_UPDATES, NOTIFICATION_CHANNEL.INBOX, false);
      await container.preferenceRepository.save(pref);

      await eventBus.publish(
        busEvent('FulfillmentCreated', fulfillmentId, {
          customerId,
          restaurantId,
          total: { amount: 500, currency: 'INR' },
        })
      );

      expect(await NotificationModel.findOne({ recipientUserId: customerId }).lean()).toBeNull();
    });
  });
});
