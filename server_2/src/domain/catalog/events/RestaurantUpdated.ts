import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export class RestaurantUpdated implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'RestaurantUpdated';
  public readonly aggregateId: string;

  constructor(restaurantId: string, public readonly changedFields: string[]) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = restaurantId;
  }
}
