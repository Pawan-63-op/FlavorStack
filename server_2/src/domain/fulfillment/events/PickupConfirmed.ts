import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export interface PickupConfirmedPayload {
  fulfillmentId: string;
  riderId: string;
  pickedUpAt: Date;
}

export class PickupConfirmed implements DomainEvent {
  readonly eventId: string;
  readonly occurredOn: Date;
  readonly eventName = 'PickupConfirmed';
  readonly aggregateId: string;

  readonly riderId: string;
  readonly pickedUpAt: Date;

  constructor(payload: PickupConfirmedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = payload.fulfillmentId;

    this.riderId = payload.riderId;
    this.pickedUpAt = payload.pickedUpAt;
  }
}
