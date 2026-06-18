// Event handler: consumes Identity's PasswordChanged → a SECURITY email notification
// (engagement_module.md §3/§4). Reads only the published ACL payload (aggregateId = userId); never an
// Identity aggregate/repo. Idempotent (in-memory eventId guard + DispatchNotification dedupeKey),
// best-effort (logs + leaves the eventId unmarked on failure so the outbox can retry).
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { NOTIFICATION_CATEGORY } from '../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../domain/engagement/enums/notification-channel.enum';
import { DispatchNotification } from '../use-cases/DispatchNotification';
import { logger } from '../../../infrastructure/observability/logger';

interface ConsumedPasswordChanged extends DomainEvent {
  changedAt?: string | Date;
}

export class OnPasswordChanged {
  private readonly processedEventIds = new Set<string>();

  constructor(private readonly dispatch: DispatchNotification) {}

  async handle(event: DomainEvent): Promise<void> {
    if (this.processedEventIds.has(event.eventId)) return;
    const e = event as ConsumedPasswordChanged;

    const result = await this.dispatch.execute({
      recipientUserId: e.aggregateId,
      category: NOTIFICATION_CATEGORY.SECURITY,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      templateKey: 'password_changed',
      vars: { changedAt: e.changedAt ? new Date(e.changedAt).toISOString() : '' },
      sourceEventId: event.eventId,
    });
    if (result.isFailure) {
      logger.error(
        { eventId: event.eventId, userId: e.aggregateId, err: String(result.getError()) },
        '[OnPasswordChanged] dispatch failed'
      );
      return;
    }

    this.processedEventIds.add(event.eventId);
  }
}
