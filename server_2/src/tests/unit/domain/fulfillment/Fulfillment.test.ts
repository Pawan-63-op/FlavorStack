import { Fulfillment } from '../../../../domain/fulfillment/entities/Fulfillment';
import { FulfillmentLine } from '../../../../domain/fulfillment/value-objects/FulfillmentLine';
import { DeliveryAddress } from '../../../../domain/fulfillment/value-objects/DeliveryAddress';
import { FulfillmentCreated } from '../../../../domain/fulfillment/events/FulfillmentCreated';
import { FULFILLMENT_STATUS } from '../../../../domain/fulfillment/enums/fulfillment-status.enum';
import { Money } from '../../../../domain/shared/Money';
import { GeoPoint } from '../../../../domain/identity/value-objects/GeoPoint.vo';
import { UniqueEntityId } from '../../../../domain/shared/UniqueEntityId';

function money(amount: number): Money {
  return Money.create(amount, 'INR').getValue();
}

function buildLine(): FulfillmentLine {
  return FulfillmentLine.create({
    menuItemId: 'item-1',
    name: 'Paneer Tikka',
    quantity: 2,
    selectedOptions: [{ optionId: 'opt-1', label: 'Extra spicy', priceDelta: money(0) }],
    lineTotal: money(40000),
  }).getValue();
}

function buildAddress(): DeliveryAddress {
  return DeliveryAddress.create({
    label: 'Home',
    street: '12 MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pinCode: '560001',
    coordinates: GeoPoint.create(12.97, 77.59).getValue(),
  }).getValue();
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    orderRequestId: 'order-req-1',
    customerId: 'cust-1',
    restaurantId: 'rest-1',
    lines: [buildLine()],
    deliveryAddress: buildAddress(),
    pricingTotal: money(45000),
    ...overrides,
  };
}

describe('Fulfillment.createFromOrderRequested', () => {
  it('creates a fulfillment in CREATED and raises FulfillmentCreated', () => {
    const result = Fulfillment.createFromOrderRequested(validInput());

    expect(result.isSuccess).toBe(true);
    const fulfillment = result.getValue();
    expect(fulfillment.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.CREATED);
    expect(fulfillment.orderRequestId).toBe('order-req-1');
    expect(fulfillment.customerId).toBe('cust-1');
    expect(fulfillment.restaurantId).toBe('rest-1');
    expect(fulfillment.version).toBe(0);

    const events = fulfillment.pullDomainEvents();
    expect(events).toHaveLength(1);
    const event = events[0] as FulfillmentCreated;
    expect(event).toBeInstanceOf(FulfillmentCreated);
    expect(event.eventName).toBe('FulfillmentCreated');
    expect(event.aggregateId).toBe(fulfillment.id.toString());
    expect(event.orderRequestId).toBe('order-req-1');
    expect(event.customerId).toBe('cust-1');
    expect(event.restaurantId).toBe('rest-1');
    expect(event.total).toEqual({ amount: 45000, currency: 'INR' });
  });

  it('honours a supplied id', () => {
    const id = new UniqueEntityId('fixed-id');
    const fulfillment = Fulfillment.createFromOrderRequested(validInput({ id })).getValue();
    expect(fulfillment.id.toString()).toBe('fixed-id');
  });

  it.each([
    ['empty orderRequestId', { orderRequestId: '' }],
    ['empty customerId', { customerId: '' }],
    ['empty restaurantId', { restaurantId: '' }],
    ['no lines', { lines: [] }],
  ])('rejects %s', (_label, overrides) => {
    const result = Fulfillment.createFromOrderRequested(validInput(overrides));
    expect(result.isFailure).toBe(true);
  });

  it('rejects a non-VO delivery address', () => {
    const result = Fulfillment.createFromOrderRequested(
      validInput({ deliveryAddress: { street: 'x' } as unknown as DeliveryAddress })
    );
    expect(result.isFailure).toBe(true);
  });

  it('rejects a non-VO pricing total', () => {
    const result = Fulfillment.createFromOrderRequested(
      validInput({ pricingTotal: 45000 as unknown as Money })
    );
    expect(result.isFailure).toBe(true);
  });

  it('reconstitute raises no events', () => {
    const created = Fulfillment.createFromOrderRequested(validInput()).getValue();
    created.pullDomainEvents();
    const doc = {
      orderRequestId: created.orderRequestId,
      customerId: created.customerId,
      restaurantId: created.restaurantId,
      lines: created.lines,
      deliveryAddress: created.deliveryAddress,
      pricingTotal: created.pricingTotal,
      fulfillmentStatus: created.fulfillmentStatus,
      deliveryStatus: created.deliveryStatus,
      currentAssignment: created.currentAssignment,
      assignmentHistory: created.assignmentHistory,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      version: created.version,
    };
    const rehydrated = Fulfillment.reconstitute(doc, created.id);
    expect(rehydrated.pullDomainEvents()).toHaveLength(0);
    expect(rehydrated.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.CREATED);
  });
});
