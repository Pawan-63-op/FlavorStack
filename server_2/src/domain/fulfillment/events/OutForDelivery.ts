import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export interface OutForDeliveryPayload {
  fulfillmentId: string;
  riderId: string;
}

export class OutForDelivery implements DomainEvent {
  readonly eventId: string;
  readonly occurredOn: Date;
  readonly eventName = 'OutForDelivery';
  readonly aggregateId: string;

  readonly riderId: string;

  constructor(payload: OutForDeliveryPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = payload.fulfillmentId;

    this.riderId = payload.riderId;
  }
}
