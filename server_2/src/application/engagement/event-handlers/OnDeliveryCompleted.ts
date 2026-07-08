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

    const eligibility = await this.eligibilityRepo.findByFulfillmentId(event.aggregateId);
    if (!eligibility) {
      logger.warn(
        { eventId: event.eventId, fulfillmentId: event.aggregateId },
        '[OnDeliveryCompleted] no eligibility seeded yet — skipping (allow retry)'
      );
      return;
    }

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
