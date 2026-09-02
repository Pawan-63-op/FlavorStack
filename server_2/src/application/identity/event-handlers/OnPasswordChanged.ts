import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { IEmailQueue } from '../../shared/queues/IEmailQueue';
import { IEmailComposer } from '../../../domain/identity/services/IEmailComposer';
import { logger } from '../../../infrastructure/observability/logger';

interface ConsumedPasswordChanged extends DomainEvent {
  changedAt?: string | Date;
}

/**
 * The password-changed email. Identity owns it since Phase 5 Batch 3 — the Engagement
 * `OnPasswordChanged` handler that used to send it is gone.
 *
 * `PasswordChanged` carries only the user id, so the recipient address is resolved from the
 * user repository (the same lookup the deleted `IdentityRecipientResolver` performed).
 */
export class OnPasswordChanged {
  constructor(
    private readonly users: IUserRepository,
    private readonly emailQueue: IEmailQueue,
    private readonly emailComposer: IEmailComposer,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    const e = event as ConsumedPasswordChanged;
    const user = await this.users.findById(e.aggregateId);
    if (!user) {
      logger.error({ eventId: event.eventId, userId: e.aggregateId }, '[OnPasswordChanged] user not found');
      return;
    }

    const composed = await this.emailComposer.compose('password_changed', {
      changedAt: e.changedAt ? new Date(e.changedAt).toISOString() : '',
    });
    if (!composed) {
      logger.error(
        { eventId: event.eventId, templateKey: 'password_changed' },
        '[OnPasswordChanged] no active email template',
      );
      return;
    }

    await this.emailQueue.enqueue(
      { type: 'notification', to: user.email, subject: composed.subject, body: composed.body },
      { jobId: event.eventId },
    );
  }
}
