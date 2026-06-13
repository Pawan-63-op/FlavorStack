import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export type DeliveryZoneChangeAction = 'ADDED' | 'UPDATED' | 'REMOVED';

export class DeliveryZoneChanged implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'DeliveryZoneChanged';
  public readonly aggregateId: string;

  constructor(
    restaurantId: string,
    public readonly zoneId: string,
    public readonly action: DeliveryZoneChangeAction
  ) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = restaurantId;
  }
}
