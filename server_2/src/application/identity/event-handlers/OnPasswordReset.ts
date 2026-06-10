import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { PasswordResetRequested } from '../../../domain/identity/events/PasswordResetRequested';
import { IEmailProvider } from '../../../domain/identity/services/IEmailProvider';
import { Email } from '../../../domain/identity/value-objects/Email.vo';

export class OnPasswordReset {
  private readonly processedEventIds = new Set<string>();

  constructor(private readonly emailProvider: IEmailProvider) {}

  async handle(event: DomainEvent): Promise<void> {
    if (this.processedEventIds.has(event.eventId)) return;

    const requested = event as PasswordResetRequested;
    const emailResult = Email.create(requested.email);
    if (emailResult.isFailure) return;

    await this.emailProvider.sendNotification(
      emailResult.getValue(),
      'Password Reset Requested',
      'A password reset was requested for your account. If this was you, check your messages for the reset code we sent.',
    );

    this.processedEventIds.add(event.eventId);
  }
}
