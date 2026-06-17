// Domain event raised when a delivery is handed from a dropped rider to a new rider
// (fulfillment_module.md §5.2, Phase 5B). aggregateId = fulfillmentId; key payload: previousRiderId,
// newRiderId, attempt (the new attempt number). Routed to read models + Engagement. The folded
// reassign() + acceptByRider() of §6.1 produces exactly one of these once the new rider takes over.
import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export interface RiderReassignedPayload {
  fulfillmentId: string;
  previousRiderId: string;
  newRiderId: string;
  attempt: number;
}

export class RiderReassigned implements DomainEvent {
  readonly eventId: string;
  readonly occurredOn: Date;
  readonly eventName = 'RiderReassigned';
  readonly aggregateId: string;

  readonly previousRiderId: string;
  readonly newRiderId: string;
  readonly attempt: number;

  constructor(payload: RiderReassignedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = payload.fulfillmentId;

    this.previousRiderId = payload.previousRiderId;
    this.newRiderId = payload.newRiderId;
    this.attempt = payload.attempt;
  }
}
