import { getConnection } from '../../../infrastructure/database/connection';
import { InMemoryEventBus } from '../../../application/shared/events/InMemoryEventBus';
import { INotificationQueue } from '../../../application/shared/queues/INotificationQueue';
import { NotificationJob, EnqueueOptions } from '../../../application/shared/queues/jobs';
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { createEngagementContainer, EngagementContainer } from '../../../container/engagement.container';
import { seedNotificationTemplates } from '../../../infrastructure/database/seeds/notification-templates.seed';
import { NotificationPreference } from '../../../domain/engagement/entities/NotificationPreference';
import { NOTIFICATION_CATEGORY } from '../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../domain/engagement/enums/notification-channel.enum';

import { NotificationModel } from '../../../infrastructure/database/models/NotificationModel';
import { ReviewModel } from '../../../infrastructure/database/models/ReviewModel';
import { ReviewEligibilityModel } from '../../../infrastructure/database/models/ReviewEligibilityModel';
import { NotificationTemplateModel } from '../../../infrastructure/database/models/NotificationTemplateModel';
import { NotificationPreferenceModel } from '../../../infrastructure/database/models/NotificationPreferenceModel';
import { RestaurantRatingViewModel } from '../../../infrastructure/database/models/RestaurantRatingViewModel';
import { OutboxEventModel } from '../../../infrastructure/database/models/OutboxEventModel';

class FakeNotificationQueue implements INotificationQueue {
  public readonly jobs: { job: NotificationJob; opts?: EnqueueOptions }[] = [];
  async enqueue(job: NotificationJob, opts?: EnqueueOptions): Promise<void> {
    this.jobs.push({ job, opts });
  }
  async close(): Promise<void> {}
}

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${(seq += 1)}`;

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
  let queue: FakeNotificationQueue;
  let container: EngagementContainer;

  beforeAll(async () => {
    await Promise.all([
      NotificationModel.init(),
      ReviewModel.init(),
      ReviewEligibilityModel.init(),
      NotificationTemplateModel.init(),
      NotificationPreferenceModel.init(),
      RestaurantRatingViewModel.init(),
    ]);
  });

  beforeEach(async () => {
    eventBus = new InMemoryEventBus();
    queue = new FakeNotificationQueue();
    container = createEngagementContainer(getConnection(), eventBus, queue);
    await seedNotificationTemplates(container.templateRepository);
  });

  afterEach(async () => {
    await Promise.all([
      NotificationModel.deleteMany({}),
      ReviewModel.deleteMany({}),
      ReviewEligibilityModel.deleteMany({}),
      NotificationTemplateModel.deleteMany({}),
      NotificationPreferenceModel.deleteMany({}),
      RestaurantRatingViewModel.deleteMany({}),
      OutboxEventModel.deleteMany({}),
    ]);
  });

  describe('UserRegistered → welcome', () => {
    it('seeds a default NotificationPreference and renders a PENDING welcome notification', async () => {
      const userId = nextId('user');

      await eventBus.publish(
        busEvent('UserRegistered', userId, { email: 'jane@example.com', role: 'customer', name: 'Jane' })
      );

      const pref = await container.preferenceRepository.findByUserId(userId);
      expect(pref).not.toBeNull();
      expect(pref?.userId).toBe(userId);

      const note = await NotificationModel.findOne({ recipientUserId: userId }).lean();
      expect(note).not.toBeNull();
      expect(note?.status).toBe('PENDING');
      expect(note?.templateKey).toBe('welcome');
      expect(note?.channel).toBe('EMAIL');
      expect(note?.category).toBe('SECURITY');
      expect(note?.renderedBody).toContain('Jane');

      expect(queue.jobs).toHaveLength(1);
      expect(queue.jobs[0].job).toMatchObject({ type: 'engagement', channel: 'EMAIL' });
    });
  });

  describe('marquee chain: created → delivered → submit → approve → rating view', () => {
    it('recomputes the RestaurantRatingView from approved reviews across two fulfillments', async () => {
      const restaurantId = nextId('rest');
      const customerA = nextId('cust');
      const customerB = nextId('cust');
      const fulfillmentA = nextId('ful');
      const fulfillmentB = nextId('ful');

      for (const [fulfillmentId, customerId] of [
        [fulfillmentA, customerA],
        [fulfillmentB, customerB],
      ]) {
        await eventBus.publish(
          busEvent('FulfillmentCreated', fulfillmentId, {
            customerId,
            restaurantId,
            total: { amount: 2599, currency: 'INR' },
          })
        );
      }
      expect(await container.eligibilityRepository.findByFulfillmentId(fulfillmentA)).not.toBeNull();

      const deliveredAt = new Date('2026-06-17T10:00:00.000Z');
      for (const fulfillmentId of [fulfillmentA, fulfillmentB]) {
        await eventBus.publish(busEvent('DeliveryCompleted', fulfillmentId, { deliveredAt: deliveredAt.toISOString() }));
      }
      const eligA = await container.eligibilityRepository.findByFulfillmentId(fulfillmentA);
      expect(eligA?.deliveredAt?.toISOString()).toBe(deliveredAt.toISOString());
      const deliveredNote = await NotificationModel.findOne({ recipientUserId: customerA, templateKey: 'delivered' }).lean();
      expect(deliveredNote?.status).toBe('PENDING');

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

      expect(await container.ratingViewRepository.findByRestaurantId(restaurantId)).toBeNull();

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

      const view = await container.ratingViewRepository.findByRestaurantId(restaurantId);
      expect(view).not.toBeNull();
      expect(view?.reviewCount).toBe(2);
      expect(view?.avgRating).toBeCloseTo(4, 2); // (5 + 3) / 2
      expect(view?.distribution).toEqual({ 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 });

      const ratingResp = await container.getRestaurantRating.execute({ restaurantId });
      expect(ratingResp.isSuccess).toBe(true);
      expect(ratingResp.getValue().reviewCount).toBe(2);
    });

    it('a rejected review does NOT contribute to the rating view', async () => {
      const restaurantId = nextId('rest');
      const customerId = nextId('cust');
      const fulfillmentId = nextId('ful');

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

      expect(await container.ratingViewRepository.findByRestaurantId(restaurantId)).toBeNull();
    });
  });

  describe('status-notification chains (recipient resolved from the projection)', () => {
    const restaurantId = 'rest-status';
    let fulfillmentId: string;
    let customerId: string;

    beforeEach(async () => {
      fulfillmentId = nextId('ful');
      customerId = nextId('cust');
      await container.eligibilityRepository.upsert({
        fulfillmentId,
        customerId,
        restaurantId,
        deliveredAt: null,
        reviewed: false,
      });
    });

    it.each([
      ['ReadyForPickup', { readyAt: new Date() }, 'ready_for_pickup', 'ORDER_UPDATES', 'PUSH'],
      ['RiderAssigned', { riderId: 'r-1', assignedAt: new Date() }, 'rider_assigned', 'DELIVERY', 'PUSH'],
      ['OutForDelivery', { riderId: 'r-1' }, 'out_for_delivery', 'DELIVERY', 'PUSH'],
      ['FulfillmentCancelled', { reason: 'restaurant_closed' }, 'order_cancelled', 'ORDER_UPDATES', 'PUSH'],
    ])('%s → a PENDING %s notification to the resolved customer', async (eventName, payload, templateKey, category, channel) => {
      await eventBus.publish(busEvent(eventName, fulfillmentId, payload));

      const note = await NotificationModel.findOne({ recipientUserId: customerId, templateKey }).lean();
      expect(note).not.toBeNull();
      expect(note?.status).toBe('PENDING');
      expect(note?.category).toBe(category);
      expect(note?.channel).toBe(channel);
      expect(queue.jobs).toHaveLength(1);
    });
  });

  describe('preference suppression', () => {
    it('a disabled channel suppresses the dispatch (no notification row, no enqueue)', async () => {
      const restaurantId = nextId('rest');
      const customerId = nextId('cust');
      const fulfillmentId = nextId('ful');

      const pref = NotificationPreference.createDefault(customerId);
      pref.setChannel(NOTIFICATION_CATEGORY.ORDER_UPDATES, NOTIFICATION_CHANNEL.PUSH, false);
      await container.preferenceRepository.save(pref);

      await eventBus.publish(
        busEvent('FulfillmentCreated', fulfillmentId, {
          customerId,
          restaurantId,
          total: { amount: 500, currency: 'INR' },
        })
      );

      expect(await container.eligibilityRepository.findByFulfillmentId(fulfillmentId)).not.toBeNull();
      expect(await NotificationModel.findOne({ recipientUserId: customerId }).lean()).toBeNull();
      expect(queue.jobs).toHaveLength(0);
    });
  });
});
