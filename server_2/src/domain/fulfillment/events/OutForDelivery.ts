// Domain event raised when the rider departs the restaurant for the customer (fulfillment_module.md §5.2).
// aggregateId = fulfillmentId; key payload: riderId. Routed to QUEUE.notification (§5.3).
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
