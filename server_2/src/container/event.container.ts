import { IEventBus } from '../application/shared/events/IEventBus';
import { InMemoryEventBus } from '../application/shared/events/InMemoryEventBus';
import {
  IdentityEmailDeps,
  DriverAssignmentDeps,
  registerIdentityEventHandlers,
  registerDriverAssignmentHandlers,
} from '../application/identity/event-handlers/EventRegistry';

export interface EventContainer {
  eventBus: IEventBus;
}

export function createEventContainer(): EventContainer {
  return {
    eventBus: new InMemoryEventBus(),
  };
}

/**
 * Subscribes the Identity event handlers (`OnUserRegistered`, `OnPasswordChanged`) on `eventBus`.
 * Thin pass-through to `registerIdentityEventHandlers` — must be called before
 * `OutboxProcessor.start()` so events drained early have subscribers.
 */
export function wireIdentityEventHandlers(eventBus: IEventBus, deps: IdentityEmailDeps): void {
  registerIdentityEventHandlers(eventBus, deps);
}

/**
 * Subscribes the driver busy-state handler (`OnDriverAssignmentChanged`) on `eventBus`. Separate
 * from the email wiring above because it is the api profile's answer to a *fulfillment* concern —
 * keeping `Driver.activeOrderId` true so one rider cannot be offered every order at once.
 */
export function wireDriverAssignmentHandlers(eventBus: IEventBus, deps: DriverAssignmentDeps): void {
  registerDriverAssignmentHandlers(eventBus, deps);
}
