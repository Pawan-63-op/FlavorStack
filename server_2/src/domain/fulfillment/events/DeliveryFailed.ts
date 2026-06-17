// Domain event raised when a delivery cannot be completed (fulfillment_module.md §5.2, Phase 5B).
// Terminal off-path event (fulfillment → FAILED). aggregateId = fulfillmentId; key payload:
// riderId? (the rider who could not complete, if any), failureReason. Routed to QUEUE.notification
// (§5.3) and surfaced on the admin dashboard. Resolution is out-of-band/support — NOT a refund here.
import { DomainEvent } from '../../shared/DomainEvent';
import { FailureReasonValue } from '../enums/failure-reason.enum';
import { randomUUID } from 'crypto';

export interface DeliveryFailedPayload {
  fulfillmentId: string;
  riderId?: string | null;
  failureReason: FailureReasonValue;
}

export class DeliveryFailed implements DomainEvent {
  readonly eventId: string;
  readonly occurredOn: Date;
  readonly eventName = 'DeliveryFailed';
  readonly aggregateId: string;

  readonly riderId: string | null;
  readonly failureReason: FailureReasonValue;

  constructor(payload: DeliveryFailedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = payload.fulfillmentId;

    this.riderId = payload.riderId ?? null;
    this.failureReason = payload.failureReason;
  }
}
