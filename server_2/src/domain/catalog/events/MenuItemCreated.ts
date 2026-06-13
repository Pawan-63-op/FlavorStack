import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export class MenuItemCreated implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'MenuItemCreated';
  public readonly aggregateId: string;

  constructor(
    menuItemId: string,
    public readonly restaurantId: string,
    public readonly categoryId: string,
    public readonly name: string
  ) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = menuItemId;
  }
}
