import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export interface ReadyForPickupPayload {
  fulfillmentId: string;
  restaurantId: string;
  readyAt: Date;
}

export class ReadyForPickup implements DomainEvent {
  readonly eventId: string;
  readonly occurredOn: Date;
  readonly eventName = 'ReadyForPickup';
  readonly aggregateId: string;
  readonly restaurantId: string;
  readonly readyAt: Date;

  constructor(payload: ReadyForPickupPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = payload.fulfillmentId;
    this.restaurantId = payload.restaurantId;
    this.readyAt = payload.readyAt;
  }
}
