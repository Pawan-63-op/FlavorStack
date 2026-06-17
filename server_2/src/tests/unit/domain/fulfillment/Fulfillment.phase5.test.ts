import { Fulfillment } from '../../../../domain/fulfillment/entities/Fulfillment';
import { FulfillmentLine } from '../../../../domain/fulfillment/value-objects/FulfillmentLine';
import { DeliveryAddress } from '../../../../domain/fulfillment/value-objects/DeliveryAddress';
import { FULFILLMENT_STATUS } from '../../../../domain/fulfillment/enums/fulfillment-status.enum';
import { CANCELLED_BY } from '../../../../domain/fulfillment/enums/cancelled-by.enum';
import { FulfillmentCancelled } from '../../../../domain/fulfillment/events/FulfillmentCancelled';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';
import { Money } from '../../../../domain/shared/Money';
import { GeoPoint } from '../../../../domain/identity/value-objects/GeoPoint.vo';

const CUSTOMER_ID = 'cust-1';
const RESTAURANT_ID = 'rest-1';

function money(amount: number): Money {
  return Money.create(amount, 'INR').getValue();
}

function buildFulfillment(): Fulfillment {
  const f = Fulfillment.createFromOrderRequested({
    orderRequestId: 'order-req-1',
    customerId: CUSTOMER_ID,
    restaurantId: RESTAURANT_ID,
    lines: [
      FulfillmentLine.create({
        menuItemId: 'item-1',
        name: 'Paneer Tikka',
        quantity: 1,
        selectedOptions: [],
        lineTotal: money(40000),
      }).getValue(),
    ],
    deliveryAddress: DeliveryAddress.create({
      street: '12 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '560001',
      coordinates: GeoPoint.create(12.97, 77.59).getValue(),
    }).getValue(),
    pricingTotal: money(45000),
  }).getValue();
  f.pullDomainEvents();
  return f;
}

function future(msFromNow = 60_000): Date {
  return new Date(Date.now() + msFromNow);
}

describe('Fulfillment cancellation (Phase 5A)', () => {
  describe('allowed states', () => {
    it('cancels from CREATED, sets cancellation info and raises FulfillmentCancelled', () => {
      const f = buildFulfillment();

      const result = f.cancel(CANCELLED_BY.CUSTOMER, 'changed my mind', CUSTOMER_ID);

      expect(result.isSuccess).toBe(true);
      expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.CANCELLED);
      expect(f.fulfillmentStatus.isTerminal()).toBe(true);
      expect(f.cancellation).not.toBeNull();
      expect(f.cancellation!.cancelledBy).toBe(CANCELLED_BY.CUSTOMER);
      expect(f.cancellation!.reason).toBe('changed my mind');
      expect(f.cancellation!.at).toBeInstanceOf(Date);

      const events = f.pullDomainEvents();
      expect(events).toHaveLength(1);
      const ev = events[0] as FulfillmentCancelled;
      expect(ev).toBeInstanceOf(FulfillmentCancelled);
      expect(ev.eventName).toBe('FulfillmentCancelled');
      expect(ev.aggregateId).toBe(f.id.toString());
      expect(ev.cancelledBy).toBe(CANCELLED_BY.CUSTOMER);
      expect(ev.reason).toBe('changed my mind');
      expect(ev.refundHint.total).toEqual({ amount: 45000, currency: 'INR' });
    });

    it('cancels from PREPARING (restaurant)', () => {
      const f = buildFulfillment();
      f.startPreparation(RESTAURANT_ID);
      f.pullDomainEvents();

      const result = f.cancel(CANCELLED_BY.RESTAURANT, 'item out of stock', RESTAURANT_ID);

      expect(result.isSuccess).toBe(true);
      expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.CANCELLED);
    });

    it('cancels from READY_FOR_PICKUP (admin / SYSTEM, no ownership check)', () => {
      const f = buildFulfillment();
      f.startPreparation(RESTAURANT_ID);
      f.markReadyForPickup(RESTAURANT_ID);
      f.pullDomainEvents();

      const result = f.cancel(CANCELLED_BY.SYSTEM, 'manual admin cancel');

      expect(result.isSuccess).toBe(true);
      expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.CANCELLED);
    });
  });

  describe('disallowed states', () => {
    it('rejects cancellation after PICKED_UP', () => {
      const f = buildFulfillment();
      f.startPreparation(RESTAURANT_ID);
      f.markReadyForPickup(RESTAURANT_ID);
      f.offerToRider('rider-1', future());
      f.acceptByRider('rider-1');
      f.confirmPickup('rider-1');
      f.pullDomainEvents();

      const result = f.cancel(CANCELLED_BY.SYSTEM, 'too late');

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
      expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.PICKED_UP);
      expect(f.cancellation).toBeNull();
      expect(f.pullDomainEvents()).toHaveLength(0);
    });

    it('is terminal — a second cancel fails', () => {
      const f = buildFulfillment();
      f.cancel(CANCELLED_BY.CUSTOMER, 'changed my mind', CUSTOMER_ID);
      f.pullDomainEvents();

      expect(f.cancel(CANCELLED_BY.CUSTOMER, 'again', CUSTOMER_ID).isFailure).toBe(true);
    });
  });

  describe('ownership and actor rules', () => {
    it('forbids a customer who is not the owner', () => {
      const f = buildFulfillment();
      const result = f.cancel(CANCELLED_BY.CUSTOMER, 'not mine', 'other-customer');
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ForbiddenError);
      expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.CREATED);
    });

    it('forbids a restaurant that is not the owner', () => {
      const f = buildFulfillment();
      const result = f.cancel(CANCELLED_BY.RESTAURANT, 'not mine', 'other-restaurant');
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ForbiddenError);
    });

    it('rejects a RIDER cancellation (it is a reassignment, not a cancellation)', () => {
      const f = buildFulfillment();
      const result = f.cancel(CANCELLED_BY.RIDER, 'rider drop', 'rider-1');
      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('rejects an empty reason', () => {
      const f = buildFulfillment();
      const result = f.cancel(CANCELLED_BY.CUSTOMER, '   ', CUSTOMER_ID);
      expect(result.isFailure).toBe(true);
      expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.CREATED);
    });
  });
});
