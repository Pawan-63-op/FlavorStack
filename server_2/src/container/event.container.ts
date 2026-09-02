import { IEventBus } from '../application/shared/events/IEventBus';
import { InMemoryEventBus } from '../application/shared/events/InMemoryEventBus';
import {
  IdentityEmailDeps,
  registerIdentityEventHandlers,
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
