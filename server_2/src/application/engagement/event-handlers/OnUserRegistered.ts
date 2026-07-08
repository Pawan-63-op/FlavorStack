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
