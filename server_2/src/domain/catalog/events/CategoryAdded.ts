import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export class CategoryAdded implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'CategoryAdded';
  public readonly aggregateId: string;

  constructor(restaurantId: string, public readonly categoryId: string, public readonly label: string) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = restaurantId;
  }
}
