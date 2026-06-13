import { DomainEvent } from '../../shared/DomainEvent';
import { RestaurantStatus as RestaurantStatusValue } from '../enums/restaurant-status.enum';
import { randomUUID } from 'crypto';

export class RestaurantStatusChanged implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'RestaurantStatusChanged';
  public readonly aggregateId: string;

  constructor(
    restaurantId: string,
    public readonly previousStatus: RestaurantStatusValue,
    public readonly newStatus: RestaurantStatusValue
  ) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = restaurantId;
  }
}
