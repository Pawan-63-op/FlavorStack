import { OrderRequest } from '../../../../../domain/commerce/entities/OrderRequest';
import { OrderRequestLine } from '../../../../../domain/commerce/entities/OrderRequestLine';
import { PaymentIntent } from '../../../../../domain/commerce/value-objects/PaymentIntent';
import { IdempotencyKey } from '../../../../../domain/commerce/value-objects/IdempotencyKey';
import { PricingBreakdown } from '../../../../../domain/commerce/value-objects/PricingBreakdown';
import { Fee } from '../../../../../domain/commerce/value-objects/Fee';
import { Quantity } from '../../../../../domain/commerce/value-objects/Quantity';
import { MenuItemSnapshot } from '../../../../../domain/commerce/value-objects/snapshots/MenuItemSnapshot';
import { VariantSnapshot } from '../../../../../domain/commerce/value-objects/snapshots/VariantSnapshot';
import { RestaurantSnapshot } from '../../../../../domain/commerce/value-objects/snapshots/RestaurantSnapshot';
import { OrderRequested } from '../../../../../domain/commerce/events/OrderRequested';
import { CheckoutReadyForPayment } from '../../../../../domain/commerce/events/CheckoutReadyForPayment';
import { PAYMENT_METHOD } from '../../../../../domain/commerce/enums/payment-method.enum';
import { FEE_TYPE } from '../../../../../domain/commerce/enums/fee-type.enum';
import { ORDER_REQUEST_STATUS } from '../../../../../domain/commerce/enums/order-request-status.enum';
import { COMMERCE_RESTAURANT_STATUS } from '../../../../../domain/commerce/enums/restaurant-status.enum';
import { COMMERCE_SNAPSHOT_SCHEMA_VERSION } from '../../../../../domain/commerce/constants/snapshot-schema-version';
import { Money } from '../../../../../domain/shared/Money';
import { Address } from '../../../../../domain/identity/value-objects/Address.vo';
import { GeoPoint } from '../../../../../domain/identity/value-objects/GeoPoint.vo';

const money = (amount: number, currency = 'INR') => Money.create(amount, currency).getValue();
const qty = (n: number) => Quantity.create(n).getValue();

function line(menuItemId: string, basePrice: number, quantity: number, deltas: number[] = []): OrderRequestLine {
  const options = deltas.map((d, i) =>
    VariantSnapshot.create({ optionId: `${menuItemId}-opt-${i}`, label: `opt-${i}`, priceDelta: money(d) }).getValue()
  );
  const menuItem = MenuItemSnapshot.create({
    menuItemId,
    name: `Item ${menuItemId}`,
    basePrice: money(basePrice),
    categoryId: 'cat-1',
  }).getValue();
  const unit = basePrice + deltas.reduce((a, b) => a + b, 0);
  return OrderRequestLine.create({
    menuItem,
    selectedOptions: options,
    quantity: qty(quantity),
    lineTotal: money(unit * quantity),
  }).getValue();
}

function restaurant(): RestaurantSnapshot {
  return RestaurantSnapshot.create({
    restaurantId: 'rest-1',
    name: 'Pizza Place',
    status: COMMERCE_RESTAURANT_STATUS.ACTIVE,
    openAtCheckout: true,
    deliveryFeeInputs: { feeTiers: [{ maxDistanceMeters: 5000, fee: money(40) }] },
  }).getValue();
}

function address(): Address {
  return Address.create({
    street: '1 MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pinCode: '560001',
    coordinates: GeoPoint.create(12.97, 77.59).getValue(),
  }).getValue();
}

function validInput(overrides: Record<string, unknown> = {}) {
  const lines = [line('item-1', 1000, 2, [200]), line('item-2', 500, 1)];
  const pricing = PricingBreakdown.create({
    subtotal: money(2900),
    fees: [Fee.create({ type: FEE_TYPE.PLATFORM, amount: money(50) }).getValue()],
    discount: money(100),
    tax: money(150),
    total: money(3000), // 2900 + 50 - 100 + 150
  }).getValue();

  return {
    customerId: 'cust-1',
    idempotencyKey: IdempotencyKey.generate(),
    restaurant: restaurant(),
    lines,
    pricing,
    deliveryAddress: address(),
    paymentIntent: PaymentIntent.create({ method: PAYMENT_METHOD.UPI }).getValue(),
    ...overrides,
  };
}

describe('OrderRequest aggregate', () => {
  describe('createFromCheckout', () => {
    it('builds a REQUESTED order request from valid checkout input', () => {
      const result = OrderRequest.createFromCheckout(validInput());
      expect(result.isSuccess).toBe(true);

      const order = result.getValue();
      expect(order.status).toBe(ORDER_REQUEST_STATUS.REQUESTED);
      expect(order.customerId).toBe('cust-1');
      expect(order.lines).toHaveLength(2);
      expect(order.pricing.total.amount).toBe(3000);
      expect(order.schemaVersion).toBe(COMMERCE_SNAPSHOT_SCHEMA_VERSION);
      expect(order.createdAt).toBeInstanceOf(Date);
    });

    it('rejects an empty customerId', () => {
      expect(OrderRequest.createFromCheckout(validInput({ customerId: '' })).isFailure).toBe(true);
    });

    it('rejects an empty lines array', () => {
      expect(OrderRequest.createFromCheckout(validInput({ lines: [] })).isFailure).toBe(true);
    });

    it('rejects when pricing subtotal does not equal the sum of line totals', () => {
      const pricing = PricingBreakdown.create({
        subtotal: money(9999), // lines sum to 2900
        fees: [],
        discount: money(0),
        tax: money(0),
        total: money(9999),
      }).getValue();
      expect(OrderRequest.createFromCheckout(validInput({ pricing })).isFailure).toBe(true);
    });

    it('rejects a non-PaymentIntent paymentIntent', () => {
      expect(OrderRequest.createFromCheckout(validInput({ paymentIntent: { method: 'UPI' } })).isFailure).toBe(true);
    });

    it('rejects a non-RestaurantSnapshot restaurant', () => {
      expect(OrderRequest.createFromCheckout(validInput({ restaurant: {} })).isFailure).toBe(true);
    });
  });

  describe('events', () => {
    it('raises OrderRequested and CheckoutReadyForPayment on creation', () => {
      const order = OrderRequest.createFromCheckout(validInput()).getValue();
      const events = order.pullDomainEvents();

      expect(events).toHaveLength(2);
      const requested = events.find((e) => e.eventName === 'OrderRequested') as OrderRequested;
      const ready = events.find((e) => e.eventName === 'CheckoutReadyForPayment') as CheckoutReadyForPayment;
      expect(requested).toBeInstanceOf(OrderRequested);
      expect(ready).toBeInstanceOf(CheckoutReadyForPayment);

      expect(requested.aggregateId).toBe(order.id.toString());
      expect(requested.customerId).toBe('cust-1');
      expect(requested.restaurantId).toBe('rest-1');
      expect(requested.lines).toHaveLength(2);
      expect(requested.pricing.total).toEqual({ amount: 3000, currency: 'INR' });
      expect(requested.paymentIntent).toEqual({ method: 'UPI' });
      expect(requested.deliveryAddress.pinCode).toBe('560001');

      expect(ready.aggregateId).toBe(order.id.toString());
      expect(ready.amount).toEqual({ amount: 3000, currency: 'INR' });
      expect(ready.paymentMethod).toBe('UPI');
    });

    it('produces a fully JSON-serializable OrderRequested payload (outbox-safe)', () => {
      const order = OrderRequest.createFromCheckout(validInput()).getValue();
      const requested = order.pullDomainEvents().find((e) => e.eventName === 'OrderRequested')!;

      const roundTripped = JSON.parse(JSON.stringify(requested));
      expect(roundTripped.lines[0].lineTotal).toEqual({ amount: 2400, currency: 'INR' });
      expect(roundTripped.pricing.subtotal).toEqual({ amount: 2900, currency: 'INR' });
      expect(roundTripped.idempotencyKey).toBe(order.idempotencyKey.value);
      expect(roundTripped.schemaVersion).toBe(COMMERCE_SNAPSHOT_SCHEMA_VERSION);
    });
  });

  describe('immutability', () => {
    it('exposes lines as a defensive copy', () => {
      const order = OrderRequest.createFromCheckout(validInput()).getValue();
      order.lines.push(line('evil', 1, 1));
      expect(order.lines).toHaveLength(2);
    });

    it('reconstitute rebuilds without raising events', () => {
      const original = OrderRequest.createFromCheckout(validInput()).getValue();
      original.pullDomainEvents();

      const rebuilt = OrderRequest.reconstitute(
        {
          customerId: original.customerId,
          idempotencyKey: original.idempotencyKey,
          restaurant: original.restaurant,
          lines: original.lines,
          pricing: original.pricing,
          deliveryAddress: original.deliveryAddress,
          paymentIntent: original.paymentIntent,
          status: original.status,
          schemaVersion: original.schemaVersion,
          createdAt: original.createdAt,
        },
        original.id
      );

      expect(rebuilt.pullDomainEvents()).toHaveLength(0);
      expect(rebuilt.id.equals(original.id)).toBe(true);
    });
  });
});
