// Fulfillment Phase 8 (§5.3) — FulfillmentEventRoutes routing table tests.
//
// Fulfillment fans its customer/rider-facing status events out to QUEUE.notification, and
// additionally routes OrderRequested to QUEUE.fulfillment (the future split transport). Internal-only
// events (RiderOffered, RiderAssignmentExpired) must NOT reach notification. Registration is additive
// and idempotent — it unions onto a shared router without clobbering other contexts' routes.
// Mirrors CommerceEventRoutes.test.ts / the CatalogEventRoutes table.
import { EventRouter } from '../../../../infrastructure/outbox/EventRouter';
import {
  registerFulfillmentEventRoutes,
  FULFILLMENT_EVENT_ROUTES,
} from '../../../../infrastructure/outbox/FulfillmentEventRoutes';
import { registerCommerceEventRoutes } from '../../../../infrastructure/outbox/CommerceEventRoutes';
import { QUEUE } from '../../../../config/bullmq';

const CUSTOMER_FACING = [
  'FulfillmentCreated',
  'ReadyForPickup',
  'RiderAssigned',
  'OutForDelivery',
  'DeliveryCompleted',
  'FulfillmentCancelled',
  'DeliveryFailed',
] as const;

describe('Fulfillment event routes', () => {
  let router: EventRouter;

  beforeEach(() => {
    router = registerFulfillmentEventRoutes(new EventRouter());
  });

  it('routes every customer/rider-facing event to the notification queue', () => {
    for (const name of CUSTOMER_FACING) {
      expect(router.has(name)).toBe(true);
      expect(router.routesFor(name)).toEqual([QUEUE.notification]);
    }
  });

  it('routes OrderRequested to the fulfillment queue (future split transport)', () => {
    expect(router.routesFor('OrderRequested')).toEqual([QUEUE.fulfillment]);
  });

  it('does not route internal-only events to notification', () => {
    expect(router.has('RiderOffered')).toBe(false);
    expect(router.has('RiderAssignmentExpired')).toBe(false);
  });

  it('every route target is a known queue name', () => {
    const known = new Set<string>(Object.values(QUEUE));
    for (const queues of Object.values(FULFILLMENT_EVENT_ROUTES)) {
      for (const q of queues) expect(known.has(q)).toBe(true);
    }
  });

  it('registration is idempotent (re-running does not duplicate queues)', () => {
    registerFulfillmentEventRoutes(router);
    for (const name of CUSTOMER_FACING) {
      expect(router.routesFor(name)).toEqual([QUEUE.notification]);
    }
    expect(router.routesFor('OrderRequested')).toEqual([QUEUE.fulfillment]);
  });

  it('builds one job per published event, keyed by eventId for at-least-once dedup', () => {
    const jobs = router.route({
      eventId: 'evt-1',
      eventName: 'DeliveryCompleted',
      payload: { riderId: 'r-1' },
    });

    expect(jobs).toHaveLength(1);
    expect(jobs[0].queue).toBe(QUEUE.notification);
    expect(jobs[0].jobId).toBe('evt-1');
    expect(jobs[0].payload).toEqual({ riderId: 'r-1' });
  });

  it('is additive — registering onto a router that already has Commerce routes keeps both', () => {
    const shared = new EventRouter();
    registerCommerceEventRoutes(shared);
    registerFulfillmentEventRoutes(shared);

    // Commerce's CheckoutReadyForPayment route is untouched.
    expect(shared.routesFor('CheckoutReadyForPayment')).toEqual([QUEUE.payments]);
    // Fulfillment's notification routes are present.
    expect(shared.routesFor('FulfillmentCreated')).toEqual([QUEUE.notification]);
    // OrderRequested is unioned: Commerce's Ordering target + Fulfillment's queue.
    expect(shared.routesFor('OrderRequested').sort()).toEqual(
      [QUEUE.ordering, QUEUE.fulfillment].sort(),
    );
  });
});
