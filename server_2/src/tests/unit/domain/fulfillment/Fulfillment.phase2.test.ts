import { Fulfillment } from '../../../../domain/fulfillment/entities/Fulfillment';
import { FulfillmentLine } from '../../../../domain/fulfillment/value-objects/FulfillmentLine';
import { DeliveryAddress } from '../../../../domain/fulfillment/value-objects/DeliveryAddress';
import { FULFILLMENT_STATUS } from '../../../../domain/fulfillment/enums/fulfillment-status.enum';
import { PreparationStarted } from '../../../../domain/fulfillment/events/PreparationStarted';
import { ReadyForPickup } from '../../../../domain/fulfillment/events/ReadyForPickup';
import { Money } from '../../../../domain/shared/Money';
import { GeoPoint } from '../../../../domain/identity/value-objects/GeoPoint.vo';

function money(amount: number): Money {
  return Money.create(amount, 'INR').getValue();
}

function buildLine(): FulfillmentLine {
  return FulfillmentLine.create({
    menuItemId: 'item-1',
    name: 'Paneer Tikka',
    quantity: 1,
    selectedOptions: [],
    lineTotal: money(40000),
  }).getValue();
}

function buildAddress(): DeliveryAddress {
  return DeliveryAddress.create({
    street: '12 MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pinCode: '560001',
    coordinates: GeoPoint.create(12.97, 77.59).getValue(),
  }).getValue();
}

function buildCreatedFulfillment(restaurantId = 'rest-1'): Fulfillment {
  const f = Fulfillment.createFromOrderRequested({
    orderRequestId: 'order-req-1',
    customerId: 'cust-1',
    restaurantId,
    lines: [buildLine()],
    deliveryAddress: buildAddress(),
    pricingTotal: money(45000),
  }).getValue();
  f.pullDomainEvents(); // clear creation events
  return f;
}

// ─── startPreparation ──────────────────────────────────────────────────────────

describe('Fulfillment.startPreparation', () => {
  it('transitions CREATED → PREPARING and raises PreparationStarted', () => {
    const f = buildCreatedFulfillment();

    const result = f.startPreparation('rest-1');

    expect(result.isSuccess).toBe(true);
    expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.PREPARING);

    const events = f.pullDomainEvents();
    expect(events).toHaveLength(1);
    const ev = events[0] as PreparationStarted;
    expect(ev).toBeInstanceOf(PreparationStarted);
    expect(ev.eventName).toBe('PreparationStarted');
    expect(ev.aggregateId).toBe(f.id.toString());
    expect(ev.restaurantId).toBe('rest-1');
    expect(ev.prepEstimateMinutes).toBeUndefined();
  });

  it('carries prepEstimateMinutes in the event when provided', () => {
    const f = buildCreatedFulfillment();

    f.startPreparation('rest-1', 25);

    const ev = f.pullDomainEvents()[0] as PreparationStarted;
    expect(ev.prepEstimateMinutes).toBe(25);
    expect(f.prepEstimateMinutes).toBe(25);
  });

  it('fails when the caller restaurantId does not own the fulfillment', () => {
    const f = buildCreatedFulfillment('rest-1');

    const result = f.startPreparation('wrong-rest');

    expect(result.isFailure).toBe(true);
    const err = result.getError();
    const msg = typeof err === 'string' ? err : err.message;
    expect(msg).toMatch(/forbidden|not.*owner|restaurant/i);
    expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.CREATED);
  });

  it('fails on invalid state transition (PREPARING → PREPARING)', () => {
    const f = buildCreatedFulfillment();
    f.startPreparation('rest-1');
    f.pullDomainEvents();

    const result = f.startPreparation('rest-1');

    expect(result.isFailure).toBe(true);
    expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.PREPARING);
    expect(f.pullDomainEvents()).toHaveLength(0);
  });

  it('does not mutate status when ownership check fails', () => {
    const f = buildCreatedFulfillment('rest-1');

    f.startPreparation('bad-id');

    expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.CREATED);
    expect(f.pullDomainEvents()).toHaveLength(0);
  });
});

// ─── markReadyForPickup ────────────────────────────────────────────────────────

describe('Fulfillment.markReadyForPickup', () => {
  function buildPreparingFulfillment(): Fulfillment {
    const f = buildCreatedFulfillment();
    f.startPreparation('rest-1');
    f.pullDomainEvents();
    return f;
  }

  it('transitions PREPARING → READY_FOR_PICKUP and raises ReadyForPickup', () => {
    const f = buildPreparingFulfillment();

    const result = f.markReadyForPickup('rest-1');

    expect(result.isSuccess).toBe(true);
    expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.READY_FOR_PICKUP);

    const events = f.pullDomainEvents();
    expect(events).toHaveLength(1);
    const ev = events[0] as ReadyForPickup;
    expect(ev).toBeInstanceOf(ReadyForPickup);
    expect(ev.eventName).toBe('ReadyForPickup');
    expect(ev.aggregateId).toBe(f.id.toString());
    expect(ev.restaurantId).toBe('rest-1');
    expect(ev.readyAt).toBeInstanceOf(Date);
  });

  it('sets readyAt timestamp on the aggregate', () => {
    const f = buildPreparingFulfillment();
    const before = new Date();

    f.markReadyForPickup('rest-1');

    expect(f.readyAt).toBeInstanceOf(Date);
    expect(f.readyAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('fails when caller does not own the fulfillment', () => {
    const f = buildPreparingFulfillment();

    const result = f.markReadyForPickup('wrong-rest');

    expect(result.isFailure).toBe(true);
    expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.PREPARING);
    expect(f.pullDomainEvents()).toHaveLength(0);
  });

  it('fails on invalid state transition (CREATED → READY_FOR_PICKUP)', () => {
    const f = buildCreatedFulfillment();

    const result = f.markReadyForPickup('rest-1');

    expect(result.isFailure).toBe(true);
    expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.CREATED);
  });

  it('is idempotent-safe — second markReadyForPickup fails', () => {
    const f = buildPreparingFulfillment();
    f.markReadyForPickup('rest-1');
    f.pullDomainEvents();

    const result = f.markReadyForPickup('rest-1');

    expect(result.isFailure).toBe(true);
    expect(f.pullDomainEvents()).toHaveLength(0);
  });
});
