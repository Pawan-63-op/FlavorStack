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
