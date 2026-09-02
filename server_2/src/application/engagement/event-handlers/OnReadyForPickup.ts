import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { IFulfillmentGateway } from '../../../domain/engagement/services/IFulfillmentGateway';
import { NOTIFICATION_CATEGORY } from '../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../domain/engagement/enums/notification-channel.enum';
import { DispatchNotification } from '../use-cases/DispatchNotification';
import { logger } from '../../../infrastructure/observability/logger';

export class OnReadyForPickup {
  constructor(
    private readonly dispatch: DispatchNotification,
    private readonly fulfillmentGateway: IFulfillmentGateway
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    // The customer to notify lives on the fulfillment aggregate; the event carries only
    // its id. This previously read a replicated row that might not have been seeded yet.
    const subject = await this.fulfillmentGateway.getForReview(event.aggregateId);
    if (!subject) {
      logger.warn(
        { eventId: event.eventId, fulfillmentId: event.aggregateId },
        '[OnReadyForPickup] fulfillment not found — skipping'
      );
      return;
    }

    const result = await this.dispatch.execute({
      recipientUserId: subject.customerId,
      category: NOTIFICATION_CATEGORY.ORDER_UPDATES,
      channel: NOTIFICATION_CHANNEL.INBOX,
      templateKey: 'ready_for_pickup',
      vars: { fulfillmentId: event.aggregateId },
      sourceEventId: event.eventId,
    });
    if (result.isFailure) {
      logger.error(
        { eventId: event.eventId, fulfillmentId: event.aggregateId, err: String(result.getError()) },
        '[OnReadyForPickup] dispatch failed'
      );
      return;
    }
  }
}
