import { Fulfillment } from '../../../../domain/fulfillment/entities/Fulfillment';
import { FulfillmentLine } from '../../../../domain/fulfillment/value-objects/FulfillmentLine';
import { DeliveryAddress } from '../../../../domain/fulfillment/value-objects/DeliveryAddress';
import { FULFILLMENT_STATUS } from '../../../../domain/fulfillment/enums/fulfillment-status.enum';
import { DELIVERY_STATUS } from '../../../../domain/fulfillment/enums/delivery-status.enum';
import { PickupConfirmed } from '../../../../domain/fulfillment/events/PickupConfirmed';
import { OutForDelivery } from '../../../../domain/fulfillment/events/OutForDelivery';
import { DeliveryCompleted } from '../../../../domain/fulfillment/events/DeliveryCompleted';
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

function future(msFromNow = 60_000): Date {
  return new Date(Date.now() + msFromNow);
}

/** A fulfillment that is READY_FOR_PICKUP with an ACCEPTED rider — the gate for confirmPickup. */
function readyWithAcceptedRider(riderId = 'rider-1'): Fulfillment {
  const f = Fulfillment.createFromOrderRequested({
    orderRequestId: 'order-req-1',
    customerId: 'cust-1',
    restaurantId: 'rest-1',
    lines: [buildLine()],
    deliveryAddress: buildAddress(),
    pricingTotal: money(45000),
  }).getValue();
  f.startPreparation('rest-1');
  f.markReadyForPickup('rest-1');
  f.offerToRider(riderId, future());
  f.acceptByRider(riderId);
  f.pullDomainEvents();
  return f;
}

describe('Fulfillment delivery lifecycle (Phase 4)', () => {
  it('sets deliveryStatus to ASSIGNED when a rider accepts', () => {
    const f = readyWithAcceptedRider('rider-1');
    expect(f.deliveryStatus.value).toBe(DELIVERY_STATUS.ASSIGNED);
  });

  describe('confirmPickup', () => {
    it('moves to PICKED_UP, sets pickedUpAt and raises PickupConfirmed', () => {
      const f = readyWithAcceptedRider('rider-1');

      const result = f.confirmPickup('rider-1');

      expect(result.isSuccess).toBe(true);
      expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.PICKED_UP);
      expect(f.deliveryStatus.value).toBe(DELIVERY_STATUS.PICKED_UP);
      expect(f.pickedUpAt).toBeInstanceOf(Date);

      const events = f.pullDomainEvents();
      expect(events).toHaveLength(1);
      const ev = events[0] as PickupConfirmed;
      expect(ev).toBeInstanceOf(PickupConfirmed);
      expect(ev.eventName).toBe('PickupConfirmed');
      expect(ev.aggregateId).toBe(f.id.toString());
      expect(ev.riderId).toBe('rider-1');
      expect(ev.pickedUpAt).toBeInstanceOf(Date);
    });

    it('forbids pickup by a rider other than the assigned one', () => {
      const f = readyWithAcceptedRider('rider-1');
      const result = f.confirmPickup('rider-2');
      expect(result.isFailure).toBe(true);
      expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.READY_FOR_PICKUP);
      expect(f.pullDomainEvents()).toHaveLength(0);
    });

    it('requires READY_FOR_PICKUP — fails if the rider accepted while still PREPARING', () => {
      const f = Fulfillment.createFromOrderRequested({
        orderRequestId: 'order-req-1',
        customerId: 'cust-1',
        restaurantId: 'rest-1',
        lines: [buildLine()],
        deliveryAddress: buildAddress(),
        pricingTotal: money(45000),
      }).getValue();
      f.startPreparation('rest-1');
      f.offerToRider('rider-1', future());
      f.acceptByRider('rider-1');
      f.pullDomainEvents();

      const result = f.confirmPickup('rider-1');
      expect(result.isFailure).toBe(true);
      expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.PREPARING);
    });

    it('requires an ACCEPTED assignment — fails when only OFFERED', () => {
      const f = Fulfillment.createFromOrderRequested({
        orderRequestId: 'order-req-1',
        customerId: 'cust-1',
        restaurantId: 'rest-1',
        lines: [buildLine()],
        deliveryAddress: buildAddress(),
        pricingTotal: money(45000),
      }).getValue();
      f.startPreparation('rest-1');
      f.markReadyForPickup('rest-1');
      f.offerToRider('rider-1', future());
      f.pullDomainEvents();

      const result = f.confirmPickup('rider-1');
      expect(result.isFailure).toBe(true);
      expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.READY_FOR_PICKUP);
    });
  });

  describe('startDelivery', () => {
    it('moves PICKED_UP → OUT_FOR_DELIVERY and raises OutForDelivery', () => {
      const f = readyWithAcceptedRider('rider-1');
      f.confirmPickup('rider-1');
      f.pullDomainEvents();

      const result = f.startDelivery('rider-1');

      expect(result.isSuccess).toBe(true);
      expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.OUT_FOR_DELIVERY);
      expect(f.deliveryStatus.value).toBe(DELIVERY_STATUS.EN_ROUTE_TO_CUSTOMER);

      const events = f.pullDomainEvents();
      expect(events).toHaveLength(1);
      const ev = events[0] as OutForDelivery;
      expect(ev).toBeInstanceOf(OutForDelivery);
      expect(ev.eventName).toBe('OutForDelivery');
      expect(ev.riderId).toBe('rider-1');
    });

    it('fails before pickup', () => {
      const f = readyWithAcceptedRider('rider-1');
      const result = f.startDelivery('rider-1');
      expect(result.isFailure).toBe(true);
    });
  });

  describe('completeDelivery', () => {
    it('moves OUT_FOR_DELIVERY → DELIVERED (terminal), sets deliveredAt and raises DeliveryCompleted', () => {
      const f = readyWithAcceptedRider('rider-1');
      f.confirmPickup('rider-1');
      f.startDelivery('rider-1');
      f.pullDomainEvents();

      const result = f.completeDelivery('rider-1');

      expect(result.isSuccess).toBe(true);
      expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.DELIVERED);
      expect(f.deliveryStatus.value).toBe(DELIVERY_STATUS.DELIVERED);
      expect(f.fulfillmentStatus.isTerminal()).toBe(true);
      expect(f.deliveredAt).toBeInstanceOf(Date);

      const events = f.pullDomainEvents();
      expect(events).toHaveLength(1);
      const ev = events[0] as DeliveryCompleted;
      expect(ev).toBeInstanceOf(DeliveryCompleted);
      expect(ev.eventName).toBe('DeliveryCompleted');
      expect(ev.riderId).toBe('rider-1');
      expect(ev.deliveredAt).toBeInstanceOf(Date);
    });

    it('is terminal — a second completeDelivery fails', () => {
      const f = readyWithAcceptedRider('rider-1');
      f.confirmPickup('rider-1');
      f.startDelivery('rider-1');
      f.completeDelivery('rider-1');
      f.pullDomainEvents();

      expect(f.completeDelivery('rider-1').isFailure).toBe(true);
    });

    it('fails before the order is out for delivery', () => {
      const f = readyWithAcceptedRider('rider-1');
      f.confirmPickup('rider-1');
      expect(f.completeDelivery('rider-1').isFailure).toBe(true);
    });
  });
});
