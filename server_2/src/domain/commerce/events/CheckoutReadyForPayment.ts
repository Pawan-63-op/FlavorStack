import { DomainEvent } from '../../shared/DomainEvent';
import { MoneyJSON } from '../value-objects/snapshots/snapshot-serialization';
import { randomUUID } from 'crypto';

export interface CheckoutReadyForPaymentPayload {
  orderRequestId: string;
  customerId: string;
  amount: MoneyJSON;
  paymentMethod: string;
}

export class CheckoutReadyForPayment implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'CheckoutReadyForPayment';
  public readonly aggregateId: string;

  public readonly customerId: string;
  public readonly amount: MoneyJSON;
  public readonly paymentMethod: string;

  constructor(payload: CheckoutReadyForPaymentPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = payload.orderRequestId;

    this.customerId = payload.customerId;
    this.amount = payload.amount;
    this.paymentMethod = payload.paymentMethod;
  }
}
