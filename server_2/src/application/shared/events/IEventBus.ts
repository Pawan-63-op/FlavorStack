import { DomainEvent } from '../../../domain/shared/DomainEvent';

export interface IEventBus {
  subscribe(eventName: string, handler: (event: DomainEvent) => Promise<void>): void;
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
}
