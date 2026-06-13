import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export class MenuItemAvailabilityChanged implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'MenuItemAvailabilityChanged';
  public readonly aggregateId: string;

  constructor(
    menuItemId: string,
    public readonly restaurantId: string,
    public readonly isAvailable: boolean,
    public readonly outOfStockReason?: string
  ) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = menuItemId;
  }
}
