import { toFulfillmentResponse } from '../../../../application/fulfillment/responses/FulfillmentResponse';
import { Fulfillment } from '../../../../domain/fulfillment/entities/Fulfillment';
import { FulfillmentLine } from '../../../../domain/fulfillment/value-objects/FulfillmentLine';
import { DeliveryAddress } from '../../../../domain/fulfillment/value-objects/DeliveryAddress';
import { Money } from '../../../../domain/shared/Money';
import { GeoPoint } from '../../../../domain/identity/value-objects/GeoPoint.vo';

function money(amount: number): Money {
  return Money.create(amount, 'INR').getValue();
}

function buildFulfillment(): Fulfillment {
  const line = FulfillmentLine.create({
    menuItemId: 'item-1',
    name: 'Paneer Tikka',
    quantity: 2,
    selectedOptions: [{ optionId: 'opt-1', label: 'Extra spicy', priceDelta: money(0) }],
    lineTotal: money(80000),
  }).getValue();

  const address = DeliveryAddress.create({
    label: 'Home',
    street: '12 MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pinCode: '560001',
    coordinates: GeoPoint.create(12.97, 77.59).getValue(),
  }).getValue();

  const f = Fulfillment.createFromOrderRequested({
    orderRequestId: 'order-req-1',
    customerId: 'cust-1',
    restaurantId: 'rest-1',
    lines: [line],
    deliveryAddress: address,
    pricingTotal: money(85000),
  }).getValue();
  f.pullDomainEvents();
  return f;
}

describe('toFulfillmentResponse (G18 — owner prep visibility)', () => {
  it('surfaces order lines so the owner can see what to prepare', () => {
    const res = toFulfillmentResponse(buildFulfillment());

    expect(res.lines).toHaveLength(1);
    expect(res.lines[0]).toEqual({
      menuItemId: 'item-1',
      name: 'Paneer Tikka',
      quantity: 2,
      selectedOptions: [{ optionId: 'opt-1', label: 'Extra spicy' }],
      lineTotal: { amount: 80000, currency: 'INR' },
    });
  });

  it('surfaces the delivery address so the owner knows where it is going', () => {
    const res = toFulfillmentResponse(buildFulfillment());

    expect(res.deliveryAddress).toEqual({
      label: 'Home',
      street: '12 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '560001',
    });
  });
});
