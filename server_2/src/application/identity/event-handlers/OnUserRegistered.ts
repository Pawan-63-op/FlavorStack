import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { UserRegistered } from '../../../domain/identity/events/UserRegistered';
import { IEmailProvider } from '../../../domain/identity/services/IEmailProvider';
import { Email } from '../../../domain/identity/value-objects/Email.vo';

export class OnUserRegistered {
  private readonly processedEventIds = new Set<string>();

  constructor(private readonly emailProvider: IEmailProvider) {}

  async handle(event: DomainEvent): Promise<void> {
    if (this.processedEventIds.has(event.eventId)) return;

    const registered = event as UserRegistered;
    const emailResult = Email.create(registered.email);
    if (emailResult.isFailure) return;

    await this.emailProvider.sendNotification(
      emailResult.getValue(),
      'Welcome to FlavorStack',
      `Hi ${registered.name}, your account has been created. Please verify your email to get started.`,
    );

    this.processedEventIds.add(event.eventId);
  }
}
