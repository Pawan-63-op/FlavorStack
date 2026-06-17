// Domain event raised when a Fulfillment aggregate is created from OrderRequested
// (fulfillment_module.md §5.2). aggregateId = fulfillmentId; key payload: orderRequestId,
// customerId, restaurantId, total.
//
// Payload is JSON-safe (Money serialized as { amount, currency }), following OrderRequested's
// discipline so the shared outbox (JSON.parse(JSON.stringify(event))) serialization is lossless.
import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export interface MoneyJSON {
  amount: number;
  currency: string;
}

export interface FulfillmentCreatedPayload {
  fulfillmentId: string;
  orderRequestId: string;
  customerId: string;
  restaurantId: string;
  total: MoneyJSON;
}

export class FulfillmentCreated implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'FulfillmentCreated';
  public readonly aggregateId: string;

  public readonly orderRequestId: string;
  public readonly customerId: string;
  public readonly restaurantId: string;
  public readonly total: MoneyJSON;

  constructor(payload: FulfillmentCreatedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = payload.fulfillmentId;

    this.orderRequestId = payload.orderRequestId;
    this.customerId = payload.customerId;
    this.restaurantId = payload.restaurantId;
    this.total = payload.total;
  }
}
