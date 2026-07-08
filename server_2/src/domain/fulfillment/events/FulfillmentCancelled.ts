import { DomainEvent } from '../../shared/DomainEvent';
import { CancelledByValue } from '../enums/cancelled-by.enum';
import { randomUUID } from 'crypto';

export interface MoneyPayload {
  amount: number;
  currency: string;
}

export interface FulfillmentCancelledPayload {
  fulfillmentId: string;
  cancelledBy: CancelledByValue;
  reason: string;
  refundHint: { total: MoneyPayload };
}

export class FulfillmentCancelled implements DomainEvent {
  readonly eventId: string;
  readonly occurredOn: Date;
  readonly eventName = 'FulfillmentCancelled';
  readonly aggregateId: string;

  readonly cancelledBy: CancelledByValue;
  readonly reason: string;
  readonly refundHint: { total: MoneyPayload };

  constructor(payload: FulfillmentCancelledPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = payload.fulfillmentId;

    this.cancelledBy = payload.cancelledBy;
    this.reason = payload.reason;
    this.refundHint = payload.refundHint;
  }
}
