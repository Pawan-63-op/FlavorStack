import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

import { IEventBus } from '../../../application/shared/events/IEventBus';
import { registerIdentityEventHandlers } from '../../../application/identity/event-handlers/EventRegistry';
import { registerEngagementEventHandlers } from '../../../application/engagement/event-handlers/EngagementEventRegistry';
import { registerFulfillmentEventHandlers } from '../../../application/fulfillment/event-handlers/FulfillmentEventRegistry';
import { registerCatalogProjector } from '../../../application/catalog/handlers/CatalogProjectionRegistry';

const DOMAIN_DIR = join(__dirname, '../../../domain');
const CONTEXTS = ['identity', 'catalog', 'commerce', 'fulfillment', 'engagement'] as const;

/**
 * Every `eventName` declared by a domain event class, read from the source rather than from an
 * import list — a new event file is picked up here without anyone remembering to register it.
 */
function declaredEventNames(): string[] {
  const names: string[] = [];
  for (const context of CONTEXTS) {
    const dir = join(DOMAIN_DIR, context, 'events');
    if (!existsSync(dir)) continue; // a context may legitimately raise no events
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const match = /readonly eventName = '([^']+)'/.exec(readFileSync(join(dir, file), 'utf8'));
      if (match) names.push(match[1]);
    }
  }
  return names.sort();
}

/** Bus double that records subscriptions instead of dispatching. Handlers are never invoked. */
function recordingBus(): { bus: IEventBus; subscribed: string[] } {
  const subscribed: string[] = [];
  return {
    subscribed,
    bus: {
      subscribe: (name: string) => {
        subscribed.push(name);
      },
      publish: async () => undefined,
      publishAll: async () => undefined,
    },
  };
}

/**
 * The registries only construct handlers and close over them; nothing is called at registration
 * time, so opaque stubs are enough to walk every subscription the app installs.
 */
function subscribedEventNames(): string[] {
  const { bus, subscribed } = recordingBus();
  const stub = {} as never;

  registerIdentityEventHandlers(bus, { emailQueue: stub, emailComposer: stub, userRepository: stub });
  registerEngagementEventHandlers(bus, {
    onUserRegistered: stub,
    onFulfillmentCreated: stub,
    onReadyForPickup: stub,
    onRiderAssigned: stub,
    onOutForDelivery: stub,
    onDeliveryCompleted: stub,
    onFulfillmentCancelled: stub,
  });
  registerFulfillmentEventHandlers(bus, stub, {} as never, {} as never, {} as never);
  registerCatalogProjector(bus, stub);

  return [...new Set(subscribed)].sort();
}

/**
 * The invariant Phase 6 establishes: an event earns its place by fanning out to a handler. Events
 * that were raised, outboxed and dropped were deleted; the state they announced lives on the
 * aggregate. This test is what stops them growing back one convenient `addDomainEvent` at a time.
 */
/**
 * Phase 7.3: `OrderRequested` is delivered exclusively by the outbox relay, so it is the one
 * declared event with no in-process subscriber. It is exempted here — and asserted to have zero
 * subscribers below, so an accidental `subscribe('OrderRequested', ...)` fails the suite.
 */
const RELAY_ONLY_EVENTS = ['OrderRequested'];

describe('domain event / EventBus subscription coverage', () => {
  const declared = declaredEventNames();
  const subscribed = subscribedEventNames();

  it('finds the domain events and the registries (guards against a silent empty scan)', () => {
    expect(declared.length).toBeGreaterThan(10);
    expect(subscribed.length).toBeGreaterThan(10);
  });

  it('every declared domain event has at least one subscriber, except the relay-only ones', () => {
    expect(
      declared.filter((name) => !subscribed.includes(name) && !RELAY_ONLY_EVENTS.includes(name))
    ).toEqual([]);
  });

  it('OrderRequested has zero in-process subscribers (the relay is its only delivery path)', () => {
    expect(declared).toContain('OrderRequested');
    expect(subscribed).not.toContain('OrderRequested');
  });

  it('every subscription names a real domain event', () => {
    expect(subscribed.filter((name) => !declared.includes(name))).toEqual([]);
  });
});
