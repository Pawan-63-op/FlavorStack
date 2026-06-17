// Domain event raised when the assigned rider collects the food (fulfillment_module.md §5.2).
// aggregateId = fulfillmentId; key payload: riderId, pickedUpAt. Routed to QUEUE.notification (§5.3).
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
