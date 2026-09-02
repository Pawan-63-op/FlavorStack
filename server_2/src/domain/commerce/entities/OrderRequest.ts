import { AggregateRoot } from '../../shared/AggregateRoot';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { UniqueEntityId } from '../../shared/UniqueEntityId';
import { ValidationError } from '../../shared/errors/ValidationError';

import { OrderRequestLine } from './OrderRequestLine';
import { IdempotencyKey } from '../value-objects/IdempotencyKey';
import { PaymentIntent } from '../value-objects/PaymentIntent';
import { PricingBreakdown } from '../value-objects/PricingBreakdown';
import { RestaurantSnapshot } from '../value-objects/snapshots/RestaurantSnapshot';
import { moneyToJSON } from '../value-objects/snapshots/snapshot-serialization';
import { ORDER_REQUEST_STATUS, OrderRequestStatus } from '../enums/order-request-status.enum';
import { COMMERCE_SNAPSHOT_SCHEMA_VERSION } from '../constants/snapshot-schema-version';
import { OrderRequested, OrderRequestedAddress, OrderRequestedLine } from '../events/OrderRequested';
import { Address } from '../../identity/value-objects/Address.vo';

export interface OrderRequestProps {
  customerId: string;
  idempotencyKey: IdempotencyKey;
  restaurant: RestaurantSnapshot;
  lines: OrderRequestLine[];
  pricing: PricingBreakdown;
  deliveryAddress: Address;
  paymentIntent: PaymentIntent;
  status: OrderRequestStatus;
  schemaVersion: number;
  createdAt: Date;
}

export interface CreateOrderRequestInput {
  customerId: string;
  idempotencyKey: IdempotencyKey;
  restaurant: RestaurantSnapshot;
  lines: OrderRequestLine[];
  pricing: PricingBreakdown;
  deliveryAddress: Address;
  paymentIntent: PaymentIntent;
  schemaVersion?: number;
  id?: UniqueEntityId;
}

export class OrderRequest extends AggregateRoot<OrderRequestProps> {
  private constructor(props: OrderRequestProps, id?: UniqueEntityId) {
    super(props, id);
  }

  get customerId(): string {
    return this.props.customerId;
  }

  get idempotencyKey(): IdempotencyKey {
    return this.props.idempotencyKey;
  }

  get restaurant(): RestaurantSnapshot {
    return this.props.restaurant;
  }

  get lines(): OrderRequestLine[] {
    return [...this.props.lines];
  }

  get pricing(): PricingBreakdown {
    return this.props.pricing;
  }

  get deliveryAddress(): Address {
    return this.props.deliveryAddress;
  }

  get paymentIntent(): PaymentIntent {
    return this.props.paymentIntent;
  }

  get status(): OrderRequestStatus {
    return this.props.status;
  }

  get schemaVersion(): number {
    return this.props.schemaVersion;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  public static createFromCheckout(input: CreateOrderRequestInput): Result<OrderRequest> {
    const customerIdCheck = Guard.againstEmptyString(input.customerId, 'CustomerId');
    if (customerIdCheck.isFailure) return Result.fail<OrderRequest>(customerIdCheck.getError());

    if (!(input.idempotencyKey instanceof IdempotencyKey)) {
      return Result.fail<OrderRequest>(new ValidationError('OrderRequest idempotencyKey must be a valid IdempotencyKey'));
    }

    if (!(input.restaurant instanceof RestaurantSnapshot)) {
      return Result.fail<OrderRequest>(new ValidationError('OrderRequest restaurant must be a valid RestaurantSnapshot'));
    }

    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      return Result.fail<OrderRequest>(new ValidationError('OrderRequest must contain at least one line'));
    }

    if (input.lines.some((l) => !(l instanceof OrderRequestLine))) {
      return Result.fail<OrderRequest>(new ValidationError('OrderRequest lines must all be OrderRequestLine entities'));
    }

    if (!(input.pricing instanceof PricingBreakdown)) {
      return Result.fail<OrderRequest>(new ValidationError('OrderRequest pricing must be a valid PricingBreakdown'));
    }

    if (!(input.deliveryAddress instanceof Address)) {
      return Result.fail<OrderRequest>(new ValidationError('OrderRequest deliveryAddress must be a valid Address'));
    }

    if (!(input.paymentIntent instanceof PaymentIntent)) {
      return Result.fail<OrderRequest>(new ValidationError('OrderRequest paymentIntent must be a valid PaymentIntent'));
    }

    let lineSum = input.lines[0]!.lineTotal;
    for (let i = 1; i < input.lines.length; i += 1) {
      const addResult = lineSum.add(input.lines[i]!.lineTotal);
      if (addResult.isFailure) return Result.fail<OrderRequest>(addResult.getError());
      lineSum = addResult.getValue();
    }
    if (!lineSum.equals(input.pricing.subtotal)) {
      return Result.fail<OrderRequest>(
        new ValidationError('OrderRequest pricing subtotal must equal the sum of line totals')
      );
    }

    const schemaVersion = input.schemaVersion ?? COMMERCE_SNAPSHOT_SCHEMA_VERSION;
    if (!Number.isInteger(schemaVersion) || schemaVersion <= 0) {
      return Result.fail<OrderRequest>(new ValidationError('OrderRequest schemaVersion must be a positive integer'));
    }

    const order = new OrderRequest(
      {
        customerId: input.customerId,
        idempotencyKey: input.idempotencyKey,
        restaurant: input.restaurant,
        lines: [...input.lines],
        pricing: input.pricing,
        deliveryAddress: input.deliveryAddress,
        paymentIntent: input.paymentIntent,
        status: ORDER_REQUEST_STATUS.REQUESTED,
        schemaVersion,
        createdAt: new Date(),
      },
      input.id
    );

    order.addDomainEvent(new OrderRequested(order.toOrderRequestedPayload()));

    return Result.ok<OrderRequest>(order);
  }

  /** Rehydrate an already-persisted, immutable order request (repository entry point; raises no events). */
  public static reconstitute(props: OrderRequestProps, id: UniqueEntityId): OrderRequest {
    return new OrderRequest({ ...props, lines: [...props.lines] }, id);
  }

  private toOrderRequestedPayload() {
    const lines: OrderRequestedLine[] = this.props.lines.map((line) => ({
      menuItemId: line.menuItem.menuItemId,
      name: line.menuItem.name,
      quantity: line.quantity.value,
      selectedOptions: line.selectedOptions.map((option) => ({
        optionId: option.optionId,
        label: option.label,
        priceDelta: moneyToJSON(option.priceDelta),
      })),
      lineTotal: moneyToJSON(line.lineTotal),
    }));

    return {
      orderRequestId: this.id.toString(),
      customerId: this.props.customerId,
      restaurantId: this.props.restaurant.restaurantId,
      lines,
      pricing: {
        subtotal: moneyToJSON(this.props.pricing.subtotal),
        fees: this.props.pricing.fees.map((fee) => ({ type: fee.type, amount: moneyToJSON(fee.amount) })),
        discount: moneyToJSON(this.props.pricing.discount),
        tax: moneyToJSON(this.props.pricing.tax),
        total: moneyToJSON(this.props.pricing.total),
      },
      deliveryAddress: OrderRequest.addressToJSON(this.props.deliveryAddress),
      paymentIntent: { method: this.props.paymentIntent.method },
      idempotencyKey: this.props.idempotencyKey.value,
      schemaVersion: this.props.schemaVersion,
    };
  }

  private static addressToJSON(address: Address): OrderRequestedAddress {
    return {
      label: address.label,
      street: address.street,
      city: address.city,
      state: address.state,
      pinCode: address.pinCode,
      coordinates: { lat: address.coordinates.lat, lng: address.coordinates.lng },
    };
  }
}
