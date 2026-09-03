import { IEventBus } from '../../shared/events/IEventBus';
import { IEmailQueue } from '../../shared/queues/IEmailQueue';
import { IEmailComposer } from '../../../domain/identity/services/IEmailComposer';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { OnUserRegistered } from './OnUserRegistered';
import { OnPasswordChanged } from './OnPasswordChanged';
import { IDriverRepository } from '../../../domain/identity/repositories/IDriverRepository';
import { OnDriverAssignmentChanged } from './OnDriverAssignmentChanged';

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

export interface DriverAssignmentDeps {
  userRepository: IUserRepository;
  driverRepository: IDriverRepository;
}

/**
 * Identity's reaction to the delivery lifecycle: one driver holds at most one job at a time.
 * `RiderAssigned` marks the rider busy; a completion credits the delivery and frees them; a
 * failure, a cancellation or a hand-over frees them without crediting anything.
 *
 * Registered separately from the email handlers because it needs a different slice of identity
 * (`IDriverRepository`) and because the worker profiles wire the two independently.
 */
export function registerDriverAssignmentHandlers(eventBus: IEventBus, deps: DriverAssignmentDeps): void {
  const handler = new OnDriverAssignmentChanged(deps.userRepository, deps.driverRepository);

  eventBus.subscribe('RiderAssigned', (event) => handler.onAssigned(event));
  eventBus.subscribe('DeliveryCompleted', (event) => handler.onCompleted(event));
  eventBus.subscribe('DeliveryFailed', (event) => handler.onReleased(event));
  eventBus.subscribe('FulfillmentCancelled', (event) => handler.onReleased(event));
  eventBus.subscribe('RiderReassigned', (event) => handler.onReleased(event));
}
