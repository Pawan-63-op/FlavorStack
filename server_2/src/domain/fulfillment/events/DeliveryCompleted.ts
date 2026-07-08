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
