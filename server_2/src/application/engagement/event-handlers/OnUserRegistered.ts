// Event handler: consumes Identity's UserRegistered off the in-process bus (engagement_module.md §3/§4).
// Two effects: (1) seed the user's default NotificationPreference, (2) dispatch the welcome notification.
//
// Decoupling: reads only the PUBLISHED UserRegistered payload (a locally-declared ACL shape) — never an
// Identity aggregate/repo. `aggregateId` is the userId.
//
// Idempotency is layered: an in-memory eventId guard skips redelivery within a process; the preference
// seed is insert-if-absent; and DispatchNotification's dedupeKey collapses duplicate notifications across
// restarts. Best-effort: a dispatch failure is logged and NOT marked processed, so the outbox can retry.
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { NotificationPreference } from '../../../domain/engagement/entities/NotificationPreference';
import { INotificationPreferenceRepository } from '../../../domain/engagement/repositories/INotificationPreferenceRepository';
import { NOTIFICATION_CATEGORY } from '../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../domain/engagement/enums/notification-channel.enum';
import { DispatchNotification } from '../use-cases/DispatchNotification';
import { logger } from '../../../infrastructure/observability/logger';

interface ConsumedUserRegistered extends DomainEvent {
  email: string;
  role: string;
  name: string;
}

export class OnUserRegistered {
  private readonly processedEventIds = new Set<string>();

  constructor(
    private readonly dispatch: DispatchNotification,
    private readonly preferenceRepo: INotificationPreferenceRepository
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    if (this.processedEventIds.has(event.eventId)) return;
    const e = event as ConsumedUserRegistered;

    // Seed default preferences once (insert-if-absent keeps redelivery non-destructive).
    const existing = await this.preferenceRepo.findByUserId(e.aggregateId);
    if (!existing) {
      await this.preferenceRepo.save(NotificationPreference.createDefault(e.aggregateId));
    }

    const result = await this.dispatch.execute({
      recipientUserId: e.aggregateId,
      category: NOTIFICATION_CATEGORY.SECURITY,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      templateKey: 'welcome',
      vars: { name: e.name ?? '' },
      sourceEventId: event.eventId,
    });
    if (result.isFailure) {
      logger.error(
        { eventId: event.eventId, userId: e.aggregateId, err: String(result.getError()) },
        '[OnUserRegistered] welcome dispatch failed'
      );
      return;
    }

    this.processedEventIds.add(event.eventId);
  }
}
