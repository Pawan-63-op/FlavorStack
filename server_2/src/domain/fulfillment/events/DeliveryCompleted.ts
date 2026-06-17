// Domain event raised when the rider hands the order to the customer (fulfillment_module.md §5.2).
// Terminal happy-path event. aggregateId = fulfillmentId; key payload: riderId, deliveredAt.
// Routed to QUEUE.notification (§5.3); Engagement/Loyalty (future) react for loyalty credit.
import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export interface DeliveryCompletedPayload {
  fulfillmentId: string;
  riderId: string;
  deliveredAt: Date;
}

export class DeliveryCompleted implements DomainEvent {
  readonly eventId: string;
  readonly occurredOn: Date;
  readonly eventName = 'DeliveryCompleted';
  readonly aggregateId: string;

  readonly riderId: string;
  readonly deliveredAt: Date;

  constructor(payload: DeliveryCompletedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = payload.fulfillmentId;

    this.riderId = payload.riderId;
    this.deliveredAt = payload.deliveredAt;
  }
}
