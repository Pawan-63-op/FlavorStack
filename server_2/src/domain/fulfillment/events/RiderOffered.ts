// Domain event raised when a rider is offered a delivery (fulfillment_module.md §5.2).
// Internal event (drives the rider queue read model + retry job); aggregateId = fulfillmentId.
// Payload is JSON-safe (expiresAt serialized to ISO by the shared outbox) so serialization is lossless.
import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export interface RiderOfferedPayload {
  fulfillmentId: string;
  riderId: string;
  attempt: number;
  expiresAt: Date;
}

export class RiderOffered implements DomainEvent {
  readonly eventId: string;
  readonly occurredOn: Date;
  readonly eventName = 'RiderOffered';
  readonly aggregateId: string;

  readonly riderId: string;
  readonly attempt: number;
  readonly expiresAt: Date;

  constructor(payload: RiderOfferedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = payload.fulfillmentId;

    this.riderId = payload.riderId;
    this.attempt = payload.attempt;
    this.expiresAt = payload.expiresAt;
  }
}
