import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { IReviewEligibilityRepository } from '../../../domain/engagement/repositories/IReviewEligibilityRepository';
import { NOTIFICATION_CATEGORY } from '../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../domain/engagement/enums/notification-channel.enum';
import { DispatchNotification } from '../use-cases/DispatchNotification';
import { logger } from '../../../infrastructure/observability/logger';

interface ConsumedFulfillmentCancelled extends DomainEvent {
  reason?: string;
}

export class OnFulfillmentCancelled {
  private readonly processedEventIds = new Set<string>();

  constructor(
    private readonly dispatch: DispatchNotification,
    private readonly eligibilityRepo: IReviewEligibilityRepository
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    if (this.processedEventIds.has(event.eventId)) return;
    const e = event as ConsumedFulfillmentCancelled;

    const eligibility = await this.eligibilityRepo.findByFulfillmentId(event.aggregateId);
    if (!eligibility) {
      logger.warn(
        { eventId: event.eventId, fulfillmentId: event.aggregateId },
        '[OnFulfillmentCancelled] no eligibility seeded yet — skipping (allow retry)'
      );
      return;
    }

    const result = await this.dispatch.execute({
      recipientUserId: eligibility.customerId,
      category: NOTIFICATION_CATEGORY.ORDER_UPDATES,
      channel: NOTIFICATION_CHANNEL.PUSH,
      templateKey: 'order_cancelled',
      vars: { fulfillmentId: event.aggregateId, reason: e.reason ?? '' },
      sourceEventId: event.eventId,
    });
    if (result.isFailure) {
      logger.error(
        { eventId: event.eventId, fulfillmentId: event.aggregateId, err: String(result.getError()) },
        '[OnFulfillmentCancelled] dispatch failed'
      );
      return;
    }

    this.processedEventIds.add(event.eventId);
  }
}
