import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { NotificationPreference } from '../../../domain/engagement/entities/NotificationPreference';
import { INotificationPreferenceRepository } from '../../../domain/engagement/repositories/INotificationPreferenceRepository';

/**
 * Seeds a user's default notification preferences on first registration. The welcome *email*
 * moved to Identity's `OnUserRegistered` in Phase 5 Batch 3 — Engagement no longer sends email.
 */
export class OnUserRegistered {
  constructor(private readonly preferenceRepo: INotificationPreferenceRepository) {}

  async handle(event: DomainEvent): Promise<void> {
    const existing = await this.preferenceRepo.findByUserId(event.aggregateId);
    if (!existing) {
      await this.preferenceRepo.save(NotificationPreference.createDefault(event.aggregateId));
    }
  }
}
