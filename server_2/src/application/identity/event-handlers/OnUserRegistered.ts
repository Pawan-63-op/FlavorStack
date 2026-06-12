import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { UserRegistered } from '../../../domain/identity/events/UserRegistered';
import { IEmailQueue } from '../../shared/queues/IEmailQueue';
import { Email } from '../../../domain/identity/value-objects/Email.vo';

export class OnUserRegistered {
  private readonly processedEventIds = new Set<string>();

  constructor(private readonly emailQueue: IEmailQueue) {}

  async handle(event: DomainEvent): Promise<void> {
    if (this.processedEventIds.has(event.eventId)) return;

    const registered = event as UserRegistered;
    const emailResult = Email.create(registered.email);
    if (emailResult.isFailure) return;

    await this.emailQueue.enqueue(
      { type: 'welcome', to: emailResult.getValue().value, name: registered.name },
      { jobId: event.eventId },
    );

    this.processedEventIds.add(event.eventId);
  }
}
