// Composition root for the Identity in-process event bus and handler wiring (Phase 9, Batch 3).
import { IEventBus } from '../application/shared/events/IEventBus';
import { InMemoryEventBus } from '../application/shared/events/InMemoryEventBus';
import { IEmailProvider } from '../domain/identity/services/IEmailProvider';
import { registerIdentityEventHandlers } from '../application/identity/event-handlers/EventRegistry';

export interface EventContainer {
  eventBus: IEventBus;
}

export function createEventContainer(): EventContainer {
  return {
    eventBus: new InMemoryEventBus(),
  };
}

/**
 * Subscribes the Identity event handlers (`OnUserRegistered`, `OnPasswordReset`) on `eventBus`.
 * Thin pass-through to `registerIdentityEventHandlers` — must be called before
 * `OutboxProcessor.start()` so events drained early have subscribers.
 */
export function wireIdentityEventHandlers(eventBus: IEventBus, emailProvider: IEmailProvider): void {
  registerIdentityEventHandlers(eventBus, emailProvider);
}
