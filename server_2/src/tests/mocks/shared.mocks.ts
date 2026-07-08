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
