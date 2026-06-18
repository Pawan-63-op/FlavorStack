// Event handler: consumes Fulfillment's DeliveryCompleted off the in-process bus (engagement_module.md
// §3/§4/§7). Two effects: (1) mark the ReviewEligibility row delivered (sets deliveredAt → the order
// becomes reviewable), (2) dispatch the delivered/"rate your order" notification.
//
// Decoupling (the design's key move): DeliveryCompleted's payload lacks customerId/restaurantId, so BOTH
// the recipient and the eligibility update are resolved from the ReviewEligibility projection seeded at
// FulfillmentCreated — never from the event payload and never from a Fulfillment/Commerce repo.
// `aggregateId` is the fulfillmentId.
//
// Idempotency is layered: an in-memory eventId guard skips redelivery within a process; the eligibility
// update is an idempotent upsert; and DispatchNotification's dedupeKey collapses duplicate notifications.
// Best-effort: if eligibility isn't seeded yet (out-of-order delivery) or dispatch fails, the handler logs
// and returns WITHOUT marking the eventId, so a later redelivery re-attempts.
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { IReviewEligibilityRepository } from '../../../domain/engagement/repositories/IReviewEligibilityRepository';
import { NOTIFICATION_CATEGORY } from '../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../domain/engagement/enums/notification-channel.enum';
import { DispatchNotification } from '../use-cases/DispatchNotification';
import { logger } from '../../../infrastructure/observability/logger';

interface ConsumedDeliveryCompleted extends DomainEvent {
  deliveredAt?: string | Date;
}

export class OnDeliveryCompleted {
  private readonly processedEventIds = new Set<string>();

  constructor(
    private readonly dispatch: DispatchNotification,
    private readonly eligibilityRepo: IReviewEligibilityRepository
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    if (this.processedEventIds.has(event.eventId)) return;
    const e = event as ConsumedDeliveryCompleted;

    // Resolve customer/restaurant from the projection — the event payload carries neither.
    const eligibility = await this.eligibilityRepo.findByFulfillmentId(event.aggregateId);
    if (!eligibility) {
      logger.warn(
        { eventId: event.eventId, fulfillmentId: event.aggregateId },
        '[OnDeliveryCompleted] no eligibility seeded yet — skipping (allow retry)'
      );
      return;
    }

    // Mark delivered → the order becomes reviewable. Idempotent upsert; preserves customer/restaurant/reviewed.
    await this.eligibilityRepo.upsert({
      ...eligibility,
      deliveredAt: e.deliveredAt ? new Date(e.deliveredAt) : new Date(),
    });

    const result = await this.dispatch.execute({
      recipientUserId: eligibility.customerId,
      category: NOTIFICATION_CATEGORY.DELIVERY,
      channel: NOTIFICATION_CHANNEL.PUSH,
      templateKey: 'delivered',
      vars: { fulfillmentId: event.aggregateId },
      sourceEventId: event.eventId,
    });
    if (result.isFailure) {
      logger.error(
        { eventId: event.eventId, fulfillmentId: event.aggregateId, err: String(result.getError()) },
        '[OnDeliveryCompleted] delivered dispatch failed'
      );
      return;
    }

    this.processedEventIds.add(event.eventId);
  }
}
