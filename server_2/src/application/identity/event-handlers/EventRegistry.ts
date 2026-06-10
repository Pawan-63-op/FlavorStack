import { IEventBus } from '../../shared/events/IEventBus';
import { IEmailProvider } from '../../../domain/identity/services/IEmailProvider';
import { OnUserRegistered } from './OnUserRegistered';
import { OnPasswordReset } from './OnPasswordReset';

export function registerIdentityEventHandlers(eventBus: IEventBus, emailProvider: IEmailProvider): void {
  const onUserRegistered = new OnUserRegistered(emailProvider);
  const onPasswordReset = new OnPasswordReset(emailProvider);

  eventBus.subscribe('UserRegistered', (event) => onUserRegistered.handle(event));
  eventBus.subscribe('PasswordResetRequested', (event) => onPasswordReset.handle(event));
}
