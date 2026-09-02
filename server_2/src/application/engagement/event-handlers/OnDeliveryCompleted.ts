import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { IFulfillmentGateway } from '../../../domain/engagement/services/IFulfillmentGateway';
import { NOTIFICATION_CATEGORY } from '../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../domain/engagement/enums/notification-channel.enum';
import { DispatchNotification } from '../use-cases/DispatchNotification';
import { logger } from '../../../infrastructure/observability/logger';

export class OnDeliveryCompleted {
  constructor(
    private readonly dispatch: DispatchNotification,
    private readonly fulfillmentGateway: IFulfillmentGateway
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    // No longer stamps `deliveredAt` anywhere: review eligibility is now derived from the
    // fulfillment's own status, so this handler only resolves who to notify.
    const subject = await this.fulfillmentGateway.getForReview(event.aggregateId);
    if (!subject) {
      logger.warn(
        { eventId: event.eventId, fulfillmentId: event.aggregateId },
        '[OnDeliveryCompleted] fulfillment not found — skipping'
      );
      return;
    }

    const result = await this.dispatch.execute({
      recipientUserId: subject.customerId,
      category: NOTIFICATION_CATEGORY.DELIVERY,
      channel: NOTIFICATION_CHANNEL.INBOX,
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
  }
}
