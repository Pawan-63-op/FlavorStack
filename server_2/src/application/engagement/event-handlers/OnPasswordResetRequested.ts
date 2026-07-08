import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { NOTIFICATION_CATEGORY } from '../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../domain/engagement/enums/notification-channel.enum';
import { DispatchNotification } from '../use-cases/DispatchNotification';
import { logger } from '../../../infrastructure/observability/logger';

interface ConsumedPasswordResetRequested extends DomainEvent {
  email?: string;
}

export class OnPasswordResetRequested {
  private readonly processedEventIds = new Set<string>();

  constructor(private readonly dispatch: DispatchNotification) {}

  async handle(event: DomainEvent): Promise<void> {
    if (this.processedEventIds.has(event.eventId)) return;
    const e = event as ConsumedPasswordResetRequested;

    const result = await this.dispatch.execute({
      recipientUserId: e.aggregateId,
      category: NOTIFICATION_CATEGORY.SECURITY,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      templateKey: 'password_reset',
      vars: { email: e.email ?? '' },
      sourceEventId: event.eventId,
    });
    if (result.isFailure) {
      logger.error(
        { eventId: event.eventId, userId: e.aggregateId, err: String(result.getError()) },
        '[OnPasswordResetRequested] dispatch failed'
      );
      return;
    }

    this.processedEventIds.add(event.eventId);
  }
}
