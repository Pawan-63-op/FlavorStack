import { IEventBus } from '../../shared/events/IEventBus';
import { IEmailQueue } from '../../shared/queues/IEmailQueue';
import { IEmailComposer } from '../../../domain/identity/services/IEmailComposer';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { OnUserRegistered } from './OnUserRegistered';
import { OnPasswordChanged } from './OnPasswordChanged';

export interface IdentityEmailDeps {
  emailQueue: IEmailQueue;
  emailComposer: IEmailComposer;
  userRepository: IUserRepository;
}

/**
 * Identity is the single sender of transactional (identity) email: welcome, password-changed,
 * and — enqueued directly by the `ForgotPassword` use case — password-reset. The reset mail is not
 * event-driven at all: it must carry the OTP, which never leaves the use case.
 */
export function registerIdentityEventHandlers(eventBus: IEventBus, deps: IdentityEmailDeps): void {
  const onUserRegistered = new OnUserRegistered(deps.emailQueue, deps.emailComposer);
  const onPasswordChanged = new OnPasswordChanged(deps.userRepository, deps.emailQueue, deps.emailComposer);

  eventBus.subscribe('UserRegistered', (event) => onUserRegistered.handle(event));
  eventBus.subscribe('PasswordChanged', (event) => onPasswordChanged.handle(event));
}
