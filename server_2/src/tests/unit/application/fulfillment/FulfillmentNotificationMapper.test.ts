// Unit tests for the pure event→notification mapper (Fulfillment Phase 8, §5.2 / §5.3).
//
// Recipient resolution reads only customerId/riderId carried on the event (boundary-safe, no repo
// read). In-scope events with a resolvable recipient produce a template; out-of-scope / internal
// events and events without a recipient id produce null.
import {
  mapFulfillmentEventToNotification,
  FULFILLMENT_NOTIFICATION_EVENTS,
} from '../../../../application/fulfillment/event-handlers/FulfillmentNotificationMapper';
import { DomainEvent } from '../../../../domain/shared/DomainEvent';

function event(partial: Record<string, unknown>): DomainEvent {
  return {
    eventId: 'evt-1',
    occurredOn: new Date('2026-06-16T10:00:00.000Z'),
    aggregateId: 'ful-1',
    ...partial,
  } as unknown as DomainEvent;
}

describe('mapFulfillmentEventToNotification', () => {
  it('maps FulfillmentCreated to a customer-addressed push', () => {
    const result = mapFulfillmentEventToNotification(
      event({ eventName: 'FulfillmentCreated', customerId: 'cust-1' }),
    );

    expect(result).not.toBeNull();
    expect(result!.recipients).toEqual([{ role: 'customer', id: 'cust-1' }]);
    expect(result!.title).toBe('Order confirmed');
    expect(typeof result!.body).toBe('string');
    expect(result!.data).toEqual({ fulfillmentId: 'ful-1', event: 'FulfillmentCreated' });
  });

  it('maps rider-leg events to a rider-addressed push', () => {
    const result = mapFulfillmentEventToNotification(
      event({ eventName: 'OutForDelivery', riderId: 'rider-9' }),
    );

    expect(result!.recipients).toEqual([{ role: 'rider', id: 'rider-9' }]);
  });

  it('includes the cancellation reason in the body when present', () => {
    const result = mapFulfillmentEventToNotification(
      event({ eventName: 'FulfillmentCancelled', customerId: 'cust-1', reason: 'restaurant closed' }),
    );

    expect(result!.body).toContain('restaurant closed');
  });

  it('fans out to both customer and rider when the event carries both ids', () => {
    const result = mapFulfillmentEventToNotification(
      event({ eventName: 'DeliveryCompleted', customerId: 'cust-1', riderId: 'rider-9' }),
    );

    expect(result!.recipients).toEqual([
      { role: 'customer', id: 'cust-1' },
      { role: 'rider', id: 'rider-9' },
    ]);
  });

  it('returns null for internal-only events', () => {
    expect(mapFulfillmentEventToNotification(event({ eventName: 'RiderOffered', riderId: 'r-1' }))).toBeNull();
    expect(
      mapFulfillmentEventToNotification(event({ eventName: 'RiderAssignmentExpired', riderId: 'r-1' })),
    ).toBeNull();
  });

  it('returns null when an in-scope event carries no resolvable recipient', () => {
    // ReadyForPickup carries only restaurantId in the real payload — no customer/rider id.
    expect(
      mapFulfillmentEventToNotification(event({ eventName: 'ReadyForPickup', restaurantId: 'rest-1' })),
    ).toBeNull();
  });

  it('exposes exactly the seven §5.3 customer/rider-facing events', () => {
    expect([...FULFILLMENT_NOTIFICATION_EVENTS].sort()).toEqual(
      [
        'DeliveryCompleted',
        'DeliveryFailed',
        'FulfillmentCancelled',
        'FulfillmentCreated',
        'OutForDelivery',
        'ReadyForPickup',
        'RiderAssigned',
      ].sort(),
    );
  });
});
