import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { IEventBus } from './IEventBus';

export class InMemoryEventBus implements IEventBus {
  private readonly handlers = new Map<string, Array<(e: DomainEvent) => Promise<void>>>();

  subscribe(eventName: string, handler: (event: DomainEvent) => Promise<void>): void {
    const existing = this.handlers.get(eventName) ?? [];
    existing.push(handler);
    this.handlers.set(eventName, existing);
  }

  async publish(event: DomainEvent): Promise<void> {
    const subscribers = this.handlers.get(event.eventName) ?? [];
    const results = await Promise.allSettled(subscribers.map((h) => h(event)));
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error(`[InMemoryEventBus] Handler error for "${event.eventName}":`, result.reason);
      }
    }
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}
