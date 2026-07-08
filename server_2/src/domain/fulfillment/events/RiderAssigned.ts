import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export interface RiderAssignedPayload {
  fulfillmentId: string;
  riderId: string;
  assignedAt: Date;
}

export class RiderAssigned implements DomainEvent {
  readonly eventId: string;
  readonly occurredOn: Date;
  readonly eventName = 'RiderAssigned';
  readonly aggregateId: string;

  readonly riderId: string;
  readonly assignedAt: Date;

  constructor(payload: RiderAssignedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = payload.fulfillmentId;

    this.riderId = payload.riderId;
    this.assignedAt = payload.assignedAt;
  }
}
