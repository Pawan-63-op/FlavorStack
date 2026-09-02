import { DomainEvent } from '../../../domain/shared/DomainEvent';
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
  constructor(private readonly dispatch: DispatchNotification) {}

  async handle(event: DomainEvent): Promise<void> {
    const e = event as ConsumedFulfillmentCreated;

    const result = await this.dispatch.execute({
      recipientUserId: e.customerId,
      category: NOTIFICATION_CATEGORY.ORDER_UPDATES,
      channel: NOTIFICATION_CHANNEL.INBOX,
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
  }
}
