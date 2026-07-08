import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { IReviewEligibilityRepository } from '../../../domain/engagement/repositories/IReviewEligibilityRepository';
import { NOTIFICATION_CATEGORY } from '../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../domain/engagement/enums/notification-channel.enum';
import { DispatchNotification } from '../use-cases/DispatchNotification';
import { logger } from '../../../infrastructure/observability/logger';

interface ConsumedMoney {
  amount: number;
  currency: string;
}

interface ConsumedFulfillmentCreated extends DomainEvent {
  customerId: string;
  restaurantId: string;
  total: ConsumedMoney;
}

export class OnFulfillmentCreated {
  private readonly processedEventIds = new Set<string>();

  constructor(
    private readonly dispatch: DispatchNotification,
    private readonly eligibilityRepo: IReviewEligibilityRepository
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    if (this.processedEventIds.has(event.eventId)) return;
    const e = event as ConsumedFulfillmentCreated;

    const existing = await this.eligibilityRepo.findByFulfillmentId(e.aggregateId);
    if (!existing) {
      await this.eligibilityRepo.upsert({
        fulfillmentId: e.aggregateId,
        customerId: e.customerId,
        restaurantId: e.restaurantId,
        deliveredAt: null,
        reviewed: false,
      });
    }

    const result = await this.dispatch.execute({
      recipientUserId: e.customerId,
      category: NOTIFICATION_CATEGORY.ORDER_UPDATES,
      channel: NOTIFICATION_CHANNEL.PUSH,
      templateKey: 'order_confirmed',
      vars: { fulfillmentId: e.aggregateId },
      sourceEventId: event.eventId,
    });
    if (result.isFailure) {
      logger.error(
        { eventId: event.eventId, fulfillmentId: e.aggregateId, err: String(result.getError()) },
        '[OnFulfillmentCreated] order_confirmed dispatch failed'
      );
      return;
    }

    this.processedEventIds.add(event.eventId);
  }
}
