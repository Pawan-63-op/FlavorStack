// Internal domain event raised when a rider offer's TTL lapses without an accept
// (fulfillment_module.md §5.2, Phase 5B). aggregateId = fulfillmentId; key payload: riderId, attempt.
// Emitted by the assignment-timeout job via Fulfillment.expireCurrentOffer(); it drives the re-offer
// flow (and feeds the rider-queue read model). Not customer-facing — not routed to notifications.
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
