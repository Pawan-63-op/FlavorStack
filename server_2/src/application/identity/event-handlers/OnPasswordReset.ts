import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { PasswordResetRequested } from '../../../domain/identity/events/PasswordResetRequested';
import { IEmailQueue } from '../../shared/queues/IEmailQueue';
import { Email } from '../../../domain/identity/value-objects/Email.vo';

export class OnPasswordReset {
  private readonly processedEventIds = new Set<string>();

  constructor(private readonly emailQueue: IEmailQueue) {}

  async handle(event: DomainEvent): Promise<void> {
    if (this.processedEventIds.has(event.eventId)) return;

    const requested = event as PasswordResetRequested;
    const emailResult = Email.create(requested.email);
    if (emailResult.isFailure) return;

    await this.emailQueue.enqueue(
      { type: 'password-reset', to: emailResult.getValue().value },
      { jobId: event.eventId },
    );

    this.processedEventIds.add(event.eventId);
  }
}
