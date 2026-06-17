// Builders for Cart aggregates used by the Phase 3 persistence integration tests.
// Mirrors tests/integration/catalog/catalog-fixtures.ts — returns a domain
// aggregate built via its create()/addItem() methods so round-trip tests
// exercise the real reconstitution path.
import { Cart } from '../../../domain/commerce/entities/Cart';
import { LineItemSelection } from '../../../domain/commerce/value-objects/LineItemSelection';
import { Money } from '../../../domain/shared/Money';
import { OrderRequest } from '../../../domain/commerce/entities/OrderRequest';
import { OrderRequestLine } from '../../../domain/commerce/entities/OrderRequestLine';
import { IdempotencyKey } from '../../../domain/commerce/value-objects/IdempotencyKey';
import { PaymentIntent } from '../../../domain/commerce/value-objects/PaymentIntent';
import { PricingBreakdown } from '../../../domain/commerce/value-objects/PricingBreakdown';
import { Fee } from '../../../domain/commerce/value-objects/Fee';
import { Quantity } from '../../../domain/commerce/value-objects/Quantity';
import { MenuItemSnapshot } from '../../../domain/commerce/value-objects/snapshots/MenuItemSnapshot';
import { VariantSnapshot } from '../../../domain/commerce/value-objects/snapshots/VariantSnapshot';
import { RestaurantSnapshot } from '../../../domain/commerce/value-objects/snapshots/RestaurantSnapshot';
import { PAYMENT_METHOD } from '../../../domain/commerce/enums/payment-method.enum';
import { FEE_TYPE } from '../../../domain/commerce/enums/fee-type.enum';
import { COMMERCE_RESTAURANT_STATUS } from '../../../domain/commerce/enums/restaurant-status.enum';
import { Address } from '../../../domain/identity/value-objects/Address.vo';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';

export function buildSelection(
  overrides: Partial<{ menuItemId: string; selectedOptionIds: string[]; quantity: number }> = {}
): LineItemSelection {
  return LineItemSelection.create({
    menuItemId: 'menu-1',
    selectedOptionIds: [],
    quantity: 1,
    ...overrides,
  }).getValue();
}

export function buildMoney(amount = 1000, currency = 'INR'): Money {
  return Money.create(amount, currency).getValue();
}

// A persisted, customer-owned cart with one line item from `restaurant-1`.
export function buildCartWithItem(customerId: string, restaurantId = 'restaurant-1'): Cart {
  const cart = Cart.create(customerId).getValue();
  const result = cart.addItem(restaurantId, buildSelection(), buildMoney());
  if (result.isFailure) throw new Error(`fixture setup failed: ${String(result.getError())}`);
  cart.pullDomainEvents();
  return cart;
}

function rebuild<T>(result: { isFailure: boolean; getValue(): T; getError(): unknown }): T {
  if (result.isFailure) throw new Error(`fixture setup failed: ${String(result.getError())}`);
  return result.getValue();
}

// An immutable OrderRequest produced by the checkout factory, with two lines (one carrying a variant),
// a full pricing breakdown, a delivery address and a payment intent. Domain events are drained so the
// round-trip assertions start from a clean slate. Used by the Phase 11 persistence integration tests.
export function buildOrderRequest(
  customerId: string,
  overrides: Partial<{ idempotencyKey: IdempotencyKey }> = {}
): OrderRequest {
  const restaurant = rebuild(
    RestaurantSnapshot.create({
      restaurantId: 'restaurant-1',
      name: 'Pizza Place',
      status: COMMERCE_RESTAURANT_STATUS.ACTIVE,
      openAtCheckout: true,
      deliveryFeeInputs: {
        feeTiers: [{ maxDistanceMeters: 5000, fee: buildMoney(40) }],
        freeAboveSubtotal: buildMoney(50000),
      },
    })
  );

  const line1 = rebuild(
    OrderRequestLine.create({
      menuItem: rebuild(
        MenuItemSnapshot.create({
          menuItemId: 'menu-1',
          name: 'Margherita',
          basePrice: buildMoney(1000),
          categoryId: 'cat-1',
        })
      ),
      selectedOptions: [
        rebuild(VariantSnapshot.create({ optionId: 'opt-large', label: 'Large', priceDelta: buildMoney(200) })),
      ],
      quantity: rebuild(Quantity.create(2)),
      lineTotal: buildMoney((1000 + 200) * 2), // 2400
    })
  );

  const line2 = rebuild(
    OrderRequestLine.create({
      menuItem: rebuild(
        MenuItemSnapshot.create({
          menuItemId: 'menu-2',
          name: 'Garlic Bread',
          basePrice: buildMoney(500),
          categoryId: 'cat-2',
        })
      ),
      selectedOptions: [],
      quantity: rebuild(Quantity.create(1)),
      lineTotal: buildMoney(500),
    })
  );

  const pricing = rebuild(
    PricingBreakdown.create({
      subtotal: buildMoney(2900), // 2400 + 500
      fees: [rebuild(Fee.create({ type: FEE_TYPE.PLATFORM, amount: buildMoney(50) }))],
      discount: buildMoney(100),
      tax: buildMoney(150),
      total: buildMoney(3000), // 2900 + 50 - 100 + 150
    })
  );

  const deliveryAddress = rebuild(
    Address.create({
      label: 'Home',
      street: '1 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '560001',
      coordinates: rebuild(GeoPoint.create(12.97, 77.59)),
    })
  );

  const order = rebuild(
    OrderRequest.createFromCheckout({
      customerId,
      idempotencyKey: overrides.idempotencyKey ?? IdempotencyKey.generate(),
      restaurant,
      lines: [line1, line2],
      pricing,
      deliveryAddress,
      paymentIntent: rebuild(PaymentIntent.create({ method: PAYMENT_METHOD.UPI })),
    })
  );
  order.pullDomainEvents();
  return order;
}
