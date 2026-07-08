import { DomainEvent } from '../../shared/DomainEvent';
import { randomUUID } from 'crypto';

export interface MoneyJSON {
  amount: number;
  currency: string;
}

export interface DeliveryAddressJSON {
  label?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  coordinates: { lat: number; lng: number };
}

export interface FulfillmentLineJSON {
  menuItemId: string;
  name: string;
  quantity: number;
  lineTotal: MoneyJSON;
}

export interface FulfillmentCreatedPayload {
  fulfillmentId: string;
  orderRequestId: string;
  customerId: string;
  restaurantId: string;
  total: MoneyJSON;
  deliveryAddress: DeliveryAddressJSON;
  lines: FulfillmentLineJSON[];
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
  public readonly deliveryAddress: DeliveryAddressJSON;
  public readonly lines: FulfillmentLineJSON[];

  constructor(payload: FulfillmentCreatedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = payload.fulfillmentId;

    this.orderRequestId = payload.orderRequestId;
    this.customerId = payload.customerId;
    this.restaurantId = payload.restaurantId;
    this.total = payload.total;
    this.deliveryAddress = payload.deliveryAddress;
    this.lines = payload.lines;
  }
}
