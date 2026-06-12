import { IEventBus } from '../../shared/events/IEventBus';
import { IEmailQueue } from '../../shared/queues/IEmailQueue';
import { OnUserRegistered } from './OnUserRegistered';
import { OnPasswordReset } from './OnPasswordReset';

export function registerIdentityEventHandlers(eventBus: IEventBus, emailQueue: IEmailQueue): void {
  const onUserRegistered = new OnUserRegistered(emailQueue);
  const onPasswordReset = new OnPasswordReset(emailQueue);

  eventBus.subscribe('UserRegistered', (event) => onUserRegistered.handle(event));
  eventBus.subscribe('PasswordResetRequested', (event) => onPasswordReset.handle(event));
}
