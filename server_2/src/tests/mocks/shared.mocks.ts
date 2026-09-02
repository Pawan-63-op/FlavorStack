import { DomainEvent } from '../../domain/shared/DomainEvent';
import { InMemoryEventBus } from '../../application/shared/events/InMemoryEventBus';

export { InMemoryEventBus };

export interface EventBusSpy extends InMemoryEventBus {
  publishedEvents: DomainEvent[];
}

export function createEventBusSpy(): EventBusSpy {
  const bus = new InMemoryEventBus() as EventBusSpy;
  bus.publishedEvents = [];

  const originalPublish = bus.publish.bind(bus);
  bus.publish = async (event: DomainEvent): Promise<void> => {
    bus.publishedEvents.push(event);
    return originalPublish(event);
  };

  const originalPublishAll = bus.publishAll.bind(bus);
  bus.publishAll = async (events: DomainEvent[]): Promise<void> => {
    return originalPublishAll(events);
  };

  return bus;
}

/**
 * How many times an event name was published on a recording bus.
 *
 * Since Phase 7 the outbox carries only `OrderRequested`, so a suite that used to prove
 * "this lifecycle step emitted its event" by counting `outbox` rows counts publishes instead.
 */
export function countPublished(bus: EventBusSpy, eventName: string): number {
  return bus.publishedEvents.filter((e) => e.eventName === eventName).length;
}
