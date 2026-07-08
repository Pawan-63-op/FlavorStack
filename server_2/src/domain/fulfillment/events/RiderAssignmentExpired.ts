import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export interface RiderAssignmentExpiredPayload {
  fulfillmentId: string;
  riderId: string;
  attempt: number;
}

export class RiderAssignmentExpired implements DomainEvent {
  readonly eventId: string;
  readonly occurredOn: Date;
  readonly eventName = 'RiderAssignmentExpired';
  readonly aggregateId: string;

  readonly riderId: string;
  readonly attempt: number;

  constructor(payload: RiderAssignmentExpiredPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = payload.fulfillmentId;

    this.riderId = payload.riderId;
    this.attempt = payload.attempt;
  }
}
