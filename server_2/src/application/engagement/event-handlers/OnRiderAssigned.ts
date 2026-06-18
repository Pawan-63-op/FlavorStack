// Event handler: consumes Fulfillment's RiderAssigned → a DELIVERY push notification
// (engagement_module.md §3/§4). The event carries no customerId, so the recipient is resolved from the
// ReviewEligibility projection seeded at FulfillmentCreated — no Fulfillment/Commerce coupling.
//
// Reads only the published ACL payload (aggregateId = fulfillmentId). Idempotent (in-memory eventId guard
// + DispatchNotification dedupeKey). Best-effort: missing eligibility / dispatch failure is logged and the
// eventId is left unmarked so the outbox can retry.
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { IReviewEligibilityRepository } from '../../../domain/engagement/repositories/IReviewEligibilityRepository';
import { NOTIFICATION_CATEGORY } from '../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../domain/engagement/enums/notification-channel.enum';
import { DispatchNotification } from '../use-cases/DispatchNotification';
import { logger } from '../../../infrastructure/observability/logger';

export class OnRiderAssigned {
  private readonly processedEventIds = new Set<string>();

  constructor(
    private readonly dispatch: DispatchNotification,
    private readonly eligibilityRepo: IReviewEligibilityRepository
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    if (this.processedEventIds.has(event.eventId)) return;

    const eligibility = await this.eligibilityRepo.findByFulfillmentId(event.aggregateId);
    if (!eligibility) {
      logger.warn(
        { eventId: event.eventId, fulfillmentId: event.aggregateId },
        '[OnRiderAssigned] no eligibility seeded yet — skipping (allow retry)'
      );
      return;
    }

    const result = await this.dispatch.execute({
      recipientUserId: eligibility.customerId,
      category: NOTIFICATION_CATEGORY.DELIVERY,
      channel: NOTIFICATION_CHANNEL.PUSH,
      templateKey: 'rider_assigned',
      vars: { fulfillmentId: event.aggregateId },
      sourceEventId: event.eventId,
    });
    if (result.isFailure) {
      logger.error(
        { eventId: event.eventId, fulfillmentId: event.aggregateId, err: String(result.getError()) },
        '[OnRiderAssigned] dispatch failed'
      );
      return;
    }

    this.processedEventIds.add(event.eventId);
  }
}
