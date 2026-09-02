import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { UserRegistered } from '../../../domain/identity/events/UserRegistered';
import { IEmailQueue } from '../../shared/queues/IEmailQueue';
import { IEmailComposer } from '../../../domain/identity/services/IEmailComposer';
import { Email } from '../../../domain/identity/value-objects/Email.vo';
import { logger } from '../../../infrastructure/observability/logger';

export class OnUserRegistered {
  constructor(
    private readonly emailQueue: IEmailQueue,
    private readonly emailComposer: IEmailComposer,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    const registered = event as UserRegistered;
    const emailResult = Email.create(registered.email);
    if (emailResult.isFailure) return;

    const composed = await this.emailComposer.compose('welcome', { name: registered.name ?? '' });
    if (!composed) {
      logger.error({ eventId: event.eventId, templateKey: 'welcome' }, '[OnUserRegistered] no active email template');
      return;
    }

    await this.emailQueue.enqueue(
      {
        type: 'notification',
        to: emailResult.getValue().value,
        subject: composed.subject,
        body: composed.body,
      },
      { jobId: event.eventId },
    );
  }
}
