import { Fulfillment } from '../../../../domain/fulfillment/entities/Fulfillment';
import { FulfillmentLine } from '../../../../domain/fulfillment/value-objects/FulfillmentLine';
import { DeliveryAddress } from '../../../../domain/fulfillment/value-objects/DeliveryAddress';
import { FULFILLMENT_STATUS } from '../../../../domain/fulfillment/enums/fulfillment-status.enum';
import { DELIVERY_STATUS } from '../../../../domain/fulfillment/enums/delivery-status.enum';
import { RIDER_ASSIGNMENT_STATUS } from '../../../../domain/fulfillment/enums/rider-assignment-status.enum';
import { FAILURE_REASON } from '../../../../domain/fulfillment/enums/failure-reason.enum';
import { CANCELLED_BY } from '../../../../domain/fulfillment/enums/cancelled-by.enum';
import { DeliveryFailed } from '../../../../domain/fulfillment/events/DeliveryFailed';
import { RiderReassigned } from '../../../../domain/fulfillment/events/RiderReassigned';
import { RiderAssigned } from '../../../../domain/fulfillment/events/RiderAssigned';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';
import { ConflictError } from '../../../../domain/shared/errors/ConflictError';
import { Money } from '../../../../domain/shared/Money';
import { GeoPoint } from '../../../../domain/identity/value-objects/GeoPoint.vo';

const RESTAURANT_ID = 'rest-1';
const RIDER_1 = 'rider-1';
const RIDER_2 = 'rider-2';

function money(amount: number): Money {
  return Money.create(amount, 'INR').getValue();
}

function future(msFromNow = 60_000): Date {
  return new Date(Date.now() + msFromNow);
}

function buildFulfillment(): Fulfillment {
  const f = Fulfillment.createFromOrderRequested({
    orderRequestId: 'order-req-1',
    customerId: 'cust-1',
    restaurantId: RESTAURANT_ID,
    lines: [
      FulfillmentLine.create({
        menuItemId: 'i1',
        name: 'X',
        quantity: 1,
        selectedOptions: [],
        lineTotal: money(100),
      }).getValue(),
    ],
    deliveryAddress: DeliveryAddress.create({
      street: 'A',
      city: 'B',
      state: 'C',
      pinCode: '000001',
      coordinates: GeoPoint.create(0, 0).getValue(),
    }).getValue(),
    pricingTotal: money(100),
  }).getValue();
  f.pullDomainEvents();
  return f;
}

/** Fulfillment with an ACCEPTED rider, sitting at READY_FOR_PICKUP / delivery ASSIGNED. */
function buildAssigned(riderId = RIDER_1): Fulfillment {
  const f = buildFulfillment();
  f.startPreparation(RESTAURANT_ID);
  f.markReadyForPickup(RESTAURANT_ID);
  f.offerToRider(riderId, future());
  f.acceptByRider(riderId);
  f.pullDomainEvents();
  return f;
}

describe('Fulfillment.failDelivery (Phase 5B)', () => {
  it('fails from PICKED_UP, sets failureReason, reaches terminal FAILED and raises DeliveryFailed', () => {
    const f = buildAssigned();
    f.confirmPickup(RIDER_1);
    f.pullDomainEvents();

    const result = f.failDelivery(FAILURE_REASON.CUSTOMER_UNAVAILABLE, RIDER_1);

    expect(result.isSuccess).toBe(true);
    expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.FAILED);
    expect(f.fulfillmentStatus.isTerminal()).toBe(true);
    expect(f.deliveryStatus.value).toBe(DELIVERY_STATUS.FAILED);
    expect(f.failureReason).toBe(FAILURE_REASON.CUSTOMER_UNAVAILABLE);

    const events = f.pullDomainEvents();
    expect(events).toHaveLength(1);
    const ev = events[0] as DeliveryFailed;
    expect(ev).toBeInstanceOf(DeliveryFailed);
    expect(ev.failureReason).toBe(FAILURE_REASON.CUSTOMER_UNAVAILABLE);
    expect(ev.riderId).toBe(RIDER_1);
  });

  it('fails from OUT_FOR_DELIVERY (admin path, no riderId)', () => {
    const f = buildAssigned();
    f.confirmPickup(RIDER_1);
    f.startDelivery(RIDER_1);
    f.pullDomainEvents();

    const result = f.failDelivery(FAILURE_REASON.ADDRESS_NOT_FOUND);
    expect(result.isSuccess).toBe(true);
    expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.FAILED);
  });

  it('rejects failure before pickup (still READY_FOR_PICKUP)', () => {
    const f = buildAssigned();
    const result = f.failDelivery(FAILURE_REASON.OTHER, RIDER_1);
    expect(result.isFailure).toBe(true);
    expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.READY_FOR_PICKUP);
    expect(f.pullDomainEvents()).toHaveLength(0);
  });

  it('forbids a rider who is not the assigned one', () => {
    const f = buildAssigned();
    f.confirmPickup(RIDER_1);
    f.pullDomainEvents();
    const result = f.failDelivery(FAILURE_REASON.OTHER, 'someone-else');
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
    expect(f.fulfillmentStatus.value).toBe(FULFILLMENT_STATUS.PICKED_UP);
  });

  it('rejects an invalid failure reason', () => {
    const f = buildAssigned();
    f.confirmPickup(RIDER_1);
    f.pullDomainEvents();
    const result = f.failDelivery('NONSENSE' as never, RIDER_1);
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('is terminal — a second fail fails', () => {
    const f = buildAssigned();
    f.confirmPickup(RIDER_1);
    f.failDelivery(FAILURE_REASON.OTHER, RIDER_1);
    f.pullDomainEvents();
    expect(f.failDelivery(FAILURE_REASON.OTHER, RIDER_1).isFailure).toBe(true);
  });
});

describe('Fulfillment.reassign (Phase 5B)', () => {
  it('hands an ACCEPTED delivery to a new rider, preserving history and raising both events', () => {
    const f = buildAssigned(RIDER_1);

    const result = f.reassign(RIDER_2, future());

    expect(result.isSuccess).toBe(true);
    expect(f.assignmentHistory).toHaveLength(1);
    expect(f.assignmentHistory[0].riderId).toBe(RIDER_1);
    expect(f.assignmentHistory[0].status.value).toBe(RIDER_ASSIGNMENT_STATUS.REASSIGNED);
    expect(f.currentAssignment!.riderId).toBe(RIDER_2);
    expect(f.currentAssignment!.status.value).toBe(RIDER_ASSIGNMENT_STATUS.ACCEPTED);
    expect(f.currentAssignment!.attempt).toBe(2);
    expect(f.deliveryStatus.value).toBe(DELIVERY_STATUS.ASSIGNED);

    const events = f.pullDomainEvents();
    expect(events.map((e) => e.eventName)).toEqual(['RiderReassigned', 'RiderAssigned']);

    const ev = events[0] as RiderReassigned;
    expect(ev).toBeInstanceOf(RiderReassigned);
    expect(ev.previousRiderId).toBe(RIDER_1);
    expect(ev.newRiderId).toBe(RIDER_2);
    expect(ev.attempt).toBe(2);

    // RiderAssigned is what `OnRiderAssigned` — the only customer notifier — subscribes to.
    // Without it a reassignment was silent to the customer.
    const assigned = events[1] as RiderAssigned;
    expect(assigned).toBeInstanceOf(RiderAssigned);
    expect(assigned.riderId).toBe(RIDER_2);
  });

  it('rejects reassignment when there is no accepted rider to hand over from', () => {
    const f = buildFulfillment();
    f.startPreparation(RESTAURANT_ID);
    f.markReadyForPickup(RESTAURANT_ID);
    f.offerToRider(RIDER_1, future()); // only OFFERED, not ACCEPTED
    f.pullDomainEvents();

    const result = f.reassign(RIDER_2, future());
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('rejects reassignment after pickup (delivery no longer ASSIGNED)', () => {
    const f = buildAssigned(RIDER_1);
    f.confirmPickup(RIDER_1);
    f.pullDomainEvents();

    const result = f.reassign(RIDER_2, future());
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ConflictError);
  });

  it('rejects reassigning to the same rider', () => {
    const f = buildAssigned(RIDER_1);
    const result = f.reassign(RIDER_1, future());
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('refuses to reassign a terminal (cancelled) fulfillment', () => {
    const f = buildAssigned(RIDER_1);
    expect(f.cancel(CANCELLED_BY.SYSTEM, 'admin override').isSuccess).toBe(true);
    f.pullDomainEvents();

    const result = f.reassign(RIDER_2, future());

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ConflictError);
    expect(f.currentAssignment!.riderId).toBe(RIDER_1);
  });

  /**
   * Validate-then-commit. Before this was restructured, `reassign` pushed the old assignment to
   * history, nulled `currentAssignment` and moved the delivery to UNASSIGNED *before* the new
   * assignment was known to be constructible — so a failure past that point returned `Result.fail`
   * on a half-mutated aggregate. A past `expiresAt` is the cheapest way to fail that late step.
   */
  it('leaves the aggregate completely untouched when the replacement assignment cannot be built', () => {
    const f = buildAssigned(RIDER_1);
    f.pullDomainEvents();
    const versionBefore = f.version;
    const updatedAtBefore = f.updatedAt.getTime();

    const result = f.reassign(RIDER_2, new Date(Date.now() - 60_000));

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);

    expect(f.currentAssignment).not.toBeNull();
    expect(f.currentAssignment!.riderId).toBe(RIDER_1);
    expect(f.currentAssignment!.status.value).toBe(RIDER_ASSIGNMENT_STATUS.ACCEPTED);
    expect(f.assignmentHistory).toHaveLength(0);
    expect(f.deliveryStatus.value).toBe(DELIVERY_STATUS.ASSIGNED);
    expect(f.version).toBe(versionBefore);
    expect(f.updatedAt.getTime()).toBe(updatedAtBefore);
    expect(f.pullDomainEvents()).toHaveLength(0);
  });
});

describe('Fulfillment.expireCurrentOffer (Phase 5B)', () => {
  afterEach(() => jest.useRealTimers());

  // Phase 6: expiry raises no domain event — it had no subscriber. `assignmentHistory` is the record.
  it('expires a lapsed OFFERED assignment to history, raising no domain event', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const f = buildFulfillment();
    f.startPreparation(RESTAURANT_ID);
    f.markReadyForPickup(RESTAURANT_ID);
    f.offerToRider(RIDER_1, new Date('2026-01-01T00:01:00Z'));
    f.pullDomainEvents();

    jest.setSystemTime(new Date('2026-01-01T00:02:00Z')); // past the TTL

    const result = f.expireCurrentOffer();
    expect(result.isSuccess).toBe(true);
    expect(f.currentAssignment).toBeNull();
    expect(f.assignmentHistory).toHaveLength(1);
    expect(f.assignmentHistory[0].status.value).toBe(RIDER_ASSIGNMENT_STATUS.EXPIRED);
    expect(f.pullDomainEvents()).toEqual([]);
  });

  it('is a no-op failure when the offer has not yet expired', () => {
    const f = buildFulfillment();
    f.startPreparation(RESTAURANT_ID);
    f.markReadyForPickup(RESTAURANT_ID);
    f.offerToRider(RIDER_1, future());
    f.pullDomainEvents();

    const result = f.expireCurrentOffer();
    expect(result.isFailure).toBe(true);
    expect(f.currentAssignment).not.toBeNull();
  });
});

describe('Fulfillment.withdrawCurrentOffer (Phase 10.4)', () => {
  it('sweeps a live, unexpired OFFER into history and frees the active slot', () => {
    const f = buildFulfillment();
    f.startPreparation(RESTAURANT_ID);
    f.markReadyForPickup(RESTAURANT_ID);
    f.offerToRider(RIDER_1, future());
    f.pullDomainEvents();

    const result = f.withdrawCurrentOffer();

    expect(result.isSuccess).toBe(true);
    expect(f.currentAssignment).toBeNull();
    expect(f.assignmentHistory).toHaveLength(1);
    expect(f.assignmentHistory[0].riderId).toBe(RIDER_1);
    expect(f.assignmentHistory[0].status.value).toBe(RIDER_ASSIGNMENT_STATUS.EXPIRED);
    // No event: `assignmentHistory` is the record, exactly as for a TTL expiry.
    expect(f.pullDomainEvents()).toHaveLength(0);
  });

  it('does not require the TTL to have lapsed — that is the whole point vs expireCurrentOffer', () => {
    const f = buildFulfillment();
    f.startPreparation(RESTAURANT_ID);
    f.markReadyForPickup(RESTAURANT_ID);
    f.offerToRider(RIDER_1, future(10 * 60_000));
    f.pullDomainEvents();

    expect(f.expireCurrentOffer().isFailure).toBe(true); // not yet expired
    expect(f.withdrawCurrentOffer().isSuccess).toBe(true);
  });

  it('leaves the slot free for an immediate re-offer to a different rider', () => {
    const f = buildFulfillment();
    f.startPreparation(RESTAURANT_ID);
    f.markReadyForPickup(RESTAURANT_ID);
    f.offerToRider(RIDER_1, future());
    f.withdrawCurrentOffer();
    f.pullDomainEvents();

    expect(f.offerToRider(RIDER_2, future()).isSuccess).toBe(true);
    expect(f.currentAssignment!.riderId).toBe(RIDER_2);
    expect(f.currentAssignment!.attempt).toBe(2);
  });

  it('rejects when there is no live offer (nothing offered, or already accepted)', () => {
    const idle = buildFulfillment();
    expect(idle.withdrawCurrentOffer().isFailure).toBe(true);

    const accepted = buildAssigned(RIDER_1);
    const result = accepted.withdrawCurrentOffer();
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
    expect(accepted.currentAssignment!.riderId).toBe(RIDER_1);
  });
});
