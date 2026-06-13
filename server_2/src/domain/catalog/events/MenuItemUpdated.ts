import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export class MenuItemUpdated implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'MenuItemUpdated';
  public readonly aggregateId: string;

  constructor(menuItemId: string, public readonly changedFields: string[]) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = menuItemId;
  }
}
