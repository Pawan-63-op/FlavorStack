import { DomainEvent } from '../../shared/DomainEvent';
import { MoneyJSON } from '../value-objects/snapshots/snapshot-serialization';
import { randomUUID } from 'crypto';

export interface OrderRequestedSelectedOption {
  optionId: string;
  label: string;
  priceDelta: MoneyJSON;
}

export interface OrderRequestedLine {
  menuItemId: string;
  name: string;
  quantity: number;
  selectedOptions: OrderRequestedSelectedOption[];
  lineTotal: MoneyJSON;
}

export interface OrderRequestedPricing {
  subtotal: MoneyJSON;
  fees: { type: string; amount: MoneyJSON }[];
  discount: MoneyJSON;
  tax: MoneyJSON;
  total: MoneyJSON;
}

export interface OrderRequestedAddress {
  label?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  coordinates: { lat: number; lng: number };
}

export interface OrderRequestedPayload {
  orderRequestId: string;
  customerId: string;
  restaurantId: string;
  lines: OrderRequestedLine[];
  pricing: OrderRequestedPricing;
  deliveryAddress: OrderRequestedAddress;
  paymentIntent: { method: string };
  idempotencyKey: string;
  schemaVersion: number;
}

export class OrderRequested implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventName = 'OrderRequested';
  public readonly aggregateId: string;

  public readonly customerId: string;
  public readonly restaurantId: string;
  public readonly lines: OrderRequestedLine[];
  public readonly pricing: OrderRequestedPricing;
  public readonly deliveryAddress: OrderRequestedAddress;
  public readonly paymentIntent: { method: string };
  public readonly idempotencyKey: string;
  public readonly schemaVersion: number;

  constructor(payload: OrderRequestedPayload) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = payload.orderRequestId;

    this.customerId = payload.customerId;
    this.restaurantId = payload.restaurantId;
    this.lines = payload.lines;
    this.pricing = payload.pricing;
    this.deliveryAddress = payload.deliveryAddress;
    this.paymentIntent = payload.paymentIntent;
    this.idempotencyKey = payload.idempotencyKey;
    this.schemaVersion = payload.schemaVersion;
  }
}
