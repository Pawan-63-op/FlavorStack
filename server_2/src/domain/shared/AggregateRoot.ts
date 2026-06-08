import { Entity } from './Entity';
import { DomainEvent } from './DomainEvent';

export abstract class AggregateRoot<T> extends Entity<T> {
  private _domainEvents: DomainEvent[] = [];

  public addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  public pullDomainEvents(): DomainEvent[] {
    const eventsCopy = [...this._domainEvents];
    this.clearDomainEvents();
    return eventsCopy;
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  get domainEvents(): readonly DomainEvent[] {
    return Object.freeze(this._domainEvents);
  }
}
