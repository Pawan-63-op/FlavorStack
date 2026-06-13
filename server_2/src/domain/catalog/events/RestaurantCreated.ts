import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export class RestaurantCreated implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'RestaurantCreated';
  public readonly aggregateId: string;

  constructor(
    restaurantId: string,
    public readonly ownerId: string,
    public readonly name: string,
    public readonly slug: string
  ) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = restaurantId;
  }
}
