// Commerce Phase 14 — published cross-context event payload contract tests (commerce_module.md §8.1).
//
// The two events Commerce publishes at checkout (OrderRequested → future Ordering,
// CheckoutReadyForPayment → future Payments) are raised by the REAL OrderRequest.createFromCheckout
// path, then serialized exactly as MongoOutboxStore does (`JSON.parse(JSON.stringify(event))`) and
// validated against their frozen Zod contracts. A field rename or type drift breaks here before it
// can break a downstream consumer when services split.
import {
  COMMERCE_EVENT_SCHEMAS,
  COMMERCE_EVENT_NAMES,
  isCommerceEvent,
  assertCommerceEventContract,
  CommerceEventName,
} from '../../../../application/commerce/contracts/CommerceEventContracts';
import { DomainEvent } from '../../../../domain/shared/DomainEvent';
import { OrderRequest } from '../../../../domain/commerce/entities/OrderRequest';
import { OrderRequestLine } from '../../../../domain/commerce/entities/OrderRequestLine';
import { IdempotencyKey } from '../../../../domain/commerce/value-objects/IdempotencyKey';
import { PaymentIntent } from '../../../../domain/commerce/value-objects/PaymentIntent';
import { PricingBreakdown } from '../../../../domain/commerce/value-objects/PricingBreakdown';
import { Fee } from '../../../../domain/commerce/value-objects/Fee';
import { Quantity } from '../../../../domain/commerce/value-objects/Quantity';
import { MenuItemSnapshot } from '../../../../domain/commerce/value-objects/snapshots/MenuItemSnapshot';
import { VariantSnapshot } from '../../../../domain/commerce/value-objects/snapshots/VariantSnapshot';
import { RestaurantSnapshot } from '../../../../domain/commerce/value-objects/snapshots/RestaurantSnapshot';
import { PAYMENT_METHOD } from '../../../../domain/commerce/enums/payment-method.enum';
import { FEE_TYPE } from '../../../../domain/commerce/enums/fee-type.enum';
import { COMMERCE_RESTAURANT_STATUS } from '../../../../domain/commerce/enums/restaurant-status.enum';
import { Address } from '../../../../domain/identity/value-objects/Address.vo';
import { GeoPoint } from '../../../../domain/identity/value-objects/GeoPoint.vo';
import { Money } from '../../../../domain/shared/Money';

const get = <T>(r: { isSuccess: boolean; getValue(): T; getError(): unknown }): T => {
  if (!r.isSuccess) throw new Error(`fixture build failed: ${JSON.stringify(r.getError())}`);
  return r.getValue();
};
const money = (amount: number) => get(Money.create(amount, 'INR'));

/** Build a real OrderRequest and return its raised domain events (events NOT pulled before this). */
function checkoutEvents(): DomainEvent[] {
  const restaurant = get(
    RestaurantSnapshot.create({
      restaurantId: 'restaurant-1',
      name: 'Pizza Place',
      status: COMMERCE_RESTAURANT_STATUS.ACTIVE,
      openAtCheckout: true,
      deliveryFeeInputs: {
        feeTiers: [{ maxDistanceMeters: 5000, fee: money(40) }],
        freeAboveSubtotal: money(50000),
      },
    })
  );
  const line = get(
    OrderRequestLine.create({
      menuItem: get(
        MenuItemSnapshot.create({ menuItemId: 'menu-1', name: 'Margherita', basePrice: money(1000), categoryId: 'cat-1' })
      ),
      selectedOptions: [get(VariantSnapshot.create({ optionId: 'opt-large', label: 'Large', priceDelta: money(200) }))],
      quantity: get(Quantity.create(2)),
      lineTotal: money(2400),
    })
  );
  const pricing = get(
    PricingBreakdown.create({
      subtotal: money(2400),
      fees: [get(Fee.create({ type: FEE_TYPE.PLATFORM, amount: money(50) }))],
      discount: money(100),
      tax: money(150),
      total: money(2500),
    })
  );
  const deliveryAddress = get(
    Address.create({
      label: 'Home',
      street: '1 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '560001',
      coordinates: get(GeoPoint.create(12.97, 77.59)),
    })
  );
  const order = get(
    OrderRequest.createFromCheckout({
      customerId: 'cust-1',
      idempotencyKey: get(IdempotencyKey.create('11111111-1111-1111-1111-111111111111')),
      restaurant,
      lines: [line],
      pricing,
      deliveryAddress,
      paymentIntent: get(PaymentIntent.create({ method: PAYMENT_METHOD.UPI })),
    })
  );
  return order.pullDomainEvents();
}

/** Serialize an event exactly as MongoOutboxStore.toOutboxRow does. */
function serialized(event: DomainEvent): Record<string, unknown> {
  return JSON.parse(JSON.stringify(event)) as Record<string, unknown>;
}

describe('Commerce published event payload contracts', () => {
  const events = checkoutEvents();
  const byName = new Map(events.map((e) => [e.eventName, e]));

  it('checkout raises exactly the published events the registry declares', () => {
    expect([...byName.keys()].sort()).toEqual([...COMMERCE_EVENT_NAMES].sort());
  });

  it.each(COMMERCE_EVENT_NAMES)('%s serialized payload satisfies its contract', (name) => {
    const event = byName.get(name);
    expect(event).toBeDefined();
    const payload = serialized(event as DomainEvent);

    expect(payload.eventName).toBe(name);
    expect(isCommerceEvent(name)).toBe(true);
    expect(() => assertCommerceEventContract(name as CommerceEventName, payload)).not.toThrow();
  });

  it('OrderRequested carries the full immutable order snapshot', () => {
    const payload = serialized(byName.get('OrderRequested') as DomainEvent);
    expect(payload.customerId).toBe('cust-1');
    expect(payload.restaurantId).toBe('restaurant-1');
    expect(payload.idempotencyKey).toBe('11111111-1111-1111-1111-111111111111');
    expect(Array.isArray(payload.lines)).toBe(true);
    expect((payload.pricing as { total: { amount: number } }).total.amount).toBe(2500);
  });

  it('CheckoutReadyForPayment carries the payment intent (amount + method) only', () => {
    const payload = serialized(byName.get('CheckoutReadyForPayment') as DomainEvent);
    expect(payload.amount).toEqual({ amount: 2500, currency: 'INR' });
    expect(payload.paymentMethod).toBe(PAYMENT_METHOD.UPI);
  });

  it('rejects a payload missing a required field', () => {
    const payload = serialized(byName.get('CheckoutReadyForPayment') as DomainEvent);
    delete (payload as Record<string, unknown>).amount;
    expect(() => assertCommerceEventContract('CheckoutReadyForPayment', payload)).toThrow();
  });

  it('isCommerceEvent is false for unknown / consumed event names', () => {
    expect(isCommerceEvent('MenuItemUpdated')).toBe(false);
    expect(isCommerceEvent('nope')).toBe(false);
  });

  it('exposes a schema for every declared event name', () => {
    for (const name of COMMERCE_EVENT_NAMES) {
      expect(COMMERCE_EVENT_SCHEMAS[name]).toBeDefined();
    }
  });
});
