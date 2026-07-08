import { Fulfillment } from '../../../../domain/fulfillment/entities/Fulfillment';
import { FulfillmentLine } from '../../../../domain/fulfillment/value-objects/FulfillmentLine';
import { DeliveryAddress } from '../../../../domain/fulfillment/value-objects/DeliveryAddress';
import { FulfillmentStatus } from '../../../../domain/fulfillment/value-objects/FulfillmentStatus';
import { DeliveryStatus } from '../../../../domain/fulfillment/value-objects/DeliveryStatus';
import { RiderAssignment } from '../../../../domain/fulfillment/entities/RiderAssignment';
import { RiderAssignmentStatus } from '../../../../domain/fulfillment/value-objects/RiderAssignmentStatus';
import { UniqueEntityId } from '../../../../domain/shared/UniqueEntityId';
import { RIDER_ASSIGNMENT_STATUS } from '../../../../domain/fulfillment/enums/rider-assignment-status.enum';
import { RiderOffered } from '../../../../domain/fulfillment/events/RiderOffered';
import { RiderAssigned } from '../../../../domain/fulfillment/events/RiderAssigned';
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

function buildFulfillment(): Fulfillment {
  const f = Fulfillment.createFromOrderRequested({
    orderRequestId: 'order-req-1',
    customerId: 'cust-1',
    restaurantId: 'rest-1',
    lines: [buildLine()],
    deliveryAddress: buildAddress(),
    pricingTotal: money(45000),
  }).getValue();
  f.pullDomainEvents(); // clear creation events
  return f;
}

function future(msFromNow = 60_000): Date {
  return new Date(Date.now() + msFromNow);
}


describe('Fulfillment.offerToRider', () => {
  it('opens an OFFERED assignment (attempt 1) and raises RiderOffered', () => {
    const f = buildFulfillment();
    const expiresAt = future();

    const result = f.offerToRider('rider-1', expiresAt);

    expect(result.isSuccess).toBe(true);
    expect(f.currentAssignment).not.toBeNull();
    expect(f.currentAssignment!.riderId).toBe('rider-1');
    expect(f.currentAssignment!.attempt).toBe(1);
    expect(f.currentAssignment!.status.value).toBe(RIDER_ASSIGNMENT_STATUS.OFFERED);
    expect(f.assignmentHistory).toHaveLength(0);

    const events = f.pullDomainEvents();
    expect(events).toHaveLength(1);
    const ev = events[0] as RiderOffered;
    expect(ev).toBeInstanceOf(RiderOffered);
    expect(ev.eventName).toBe('RiderOffered');
    expect(ev.aggregateId).toBe(f.id.toString());
    expect(ev.riderId).toBe('rider-1');
    expect(ev.attempt).toBe(1);
    expect(ev.expiresAt).toBe(expiresAt);
  });

  it('rejects a second offer while one is still active (one active assignment only)', () => {
    const f = buildFulfillment();
    f.offerToRider('rider-1', future());
    f.pullDomainEvents();

    const result = f.offerToRider('rider-2', future());

    expect(result.isFailure).toBe(true);
    expect(f.currentAssignment!.riderId).toBe('rider-1');
    expect(f.pullDomainEvents()).toHaveLength(0);
  });

  it('re-offers after a rejection, incrementing attempt and keeping history', () => {
    const f = buildFulfillment();
    f.offerToRider('rider-1', future());
    f.rejectByRider('rider-1');
    f.pullDomainEvents();

    const result = f.offerToRider('rider-2', future());

    expect(result.isSuccess).toBe(true);
    expect(f.assignmentHistory).toHaveLength(1);
    expect(f.assignmentHistory[0].riderId).toBe('rider-1');
    expect(f.assignmentHistory[0].status.value).toBe(RIDER_ASSIGNMENT_STATUS.REJECTED);
    expect(f.currentAssignment!.riderId).toBe('rider-2');
    expect(f.currentAssignment!.attempt).toBe(2);
  });

  it('rejects an invalid expiresAt (not after now)', () => {
    const f = buildFulfillment();
    expect(f.offerToRider('rider-1', new Date(Date.now() - 1000)).isFailure).toBe(true);
  });
});


describe('Fulfillment.acceptByRider', () => {
  function offered(): Fulfillment {
    const f = buildFulfillment();
    f.offerToRider('rider-1', future());
    f.pullDomainEvents();
    return f;
  }

  it('accepts by the offered rider, marks ACCEPTED and raises RiderAssigned', () => {
    const f = offered();

    const result = f.acceptByRider('rider-1');

    expect(result.isSuccess).toBe(true);
    expect(f.currentAssignment!.status.value).toBe(RIDER_ASSIGNMENT_STATUS.ACCEPTED);
    expect(f.currentAssignment!.acceptedAt).toBeInstanceOf(Date);

    const events = f.pullDomainEvents();
    expect(events).toHaveLength(1);
    const ev = events[0] as RiderAssigned;
    expect(ev).toBeInstanceOf(RiderAssigned);
    expect(ev.eventName).toBe('RiderAssigned');
    expect(ev.aggregateId).toBe(f.id.toString());
    expect(ev.riderId).toBe('rider-1');
    expect(ev.assignedAt).toBeInstanceOf(Date);
  });

  it('forbids acceptance by a rider other than the offered one', () => {
    const f = offered();

    const result = f.acceptByRider('rider-2');

    expect(result.isFailure).toBe(true);
    const err = result.getError();
    const msg = typeof err === 'string' ? err : err.message;
    expect(msg).toMatch(/offered rider|forbidden/i);
    expect(f.currentAssignment!.status.value).toBe(RIDER_ASSIGNMENT_STATUS.OFFERED);
    expect(f.pullDomainEvents()).toHaveLength(0);
  });

  it('fails to accept an already-expired offer (respects expiresAt)', () => {
    const past = new Date(Date.now() - 60_000);
    const expiredOffer = RiderAssignment.reconstitute(
      {
        riderId: 'rider-1',
        status: RiderAssignmentStatus.offered(),
        attempt: 1,
        offeredAt: new Date(Date.now() - 120_000),
        acceptedAt: null,
        respondedAt: null,
        expiresAt: past,
      },
      new UniqueEntityId()
    );
    const f = Fulfillment.reconstitute(
      {
        orderRequestId: 'order-req-1',
        customerId: 'cust-1',
        restaurantId: 'rest-1',
        lines: [buildLine()],
        deliveryAddress: buildAddress(),
        pricingTotal: money(45000),
        fulfillmentStatus: FulfillmentStatus.created(),
        deliveryStatus: DeliveryStatus.unassigned(),
        currentAssignment: expiredOffer,
        assignmentHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      },
      new UniqueEntityId()
    );

    const result = f.acceptByRider('rider-1');

    expect(result.isFailure).toBe(true);
    expect(f.currentAssignment!.status.value).toBe(RIDER_ASSIGNMENT_STATUS.OFFERED);
    expect(f.pullDomainEvents()).toHaveLength(0);
  });

  it('fails when there is no active offer', () => {
    const f = buildFulfillment();
    expect(f.acceptByRider('rider-1').isFailure).toBe(true);
  });
});


describe('Fulfillment.rejectByRider', () => {
  function offered(): Fulfillment {
    const f = buildFulfillment();
    f.offerToRider('rider-1', future());
    f.pullDomainEvents();
    return f;
  }

  it('moves the rejected assignment to history and frees the active slot (no event)', () => {
    const f = offered();

    const result = f.rejectByRider('rider-1');

    expect(result.isSuccess).toBe(true);
    expect(f.currentAssignment).toBeNull();
    expect(f.assignmentHistory).toHaveLength(1);
    expect(f.assignmentHistory[0].status.value).toBe(RIDER_ASSIGNMENT_STATUS.REJECTED);
    expect(f.pullDomainEvents()).toHaveLength(0);
  });

  it('forbids rejection by a rider other than the offered one', () => {
    const f = offered();

    const result = f.rejectByRider('rider-2');

    expect(result.isFailure).toBe(true);
    expect(f.currentAssignment!.status.value).toBe(RIDER_ASSIGNMENT_STATUS.OFFERED);
  });

  it('fails when there is no active offer', () => {
    const f = buildFulfillment();
    expect(f.rejectByRider('rider-1').isFailure).toBe(true);
  });

  it('cannot reject an already-accepted assignment', () => {
    const f = offered();
    f.acceptByRider('rider-1');
    f.pullDomainEvents();

    expect(f.rejectByRider('rider-1').isFailure).toBe(true);
  });
});
