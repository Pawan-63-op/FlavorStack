import { EventRouter } from '../../../../infrastructure/outbox/EventRouter';
import {
  registerCommerceEventRoutes,
  COMMERCE_EVENT_ROUTES,
  COMMERCE_OUTBOX_EVENT_NAMES,
} from '../../../../infrastructure/outbox/CommerceEventRoutes';
import { QUEUE } from '../../../../config/bullmq';

describe('Commerce event routes', () => {
  let router: EventRouter;

  beforeEach(() => {
    router = registerCommerceEventRoutes(new EventRouter());
  });

  it('routes every published commerce outbox event to at least one queue', () => {
    for (const name of COMMERCE_OUTBOX_EVENT_NAMES) {
      expect(router.has(name)).toBe(true);
      expect(router.routesFor(name).length).toBeGreaterThan(0);
    }
  });

  it('routes per the blueprint consumer map (OrderRequested→Ordering, CheckoutReadyForPayment→Payments)', () => {
    expect(router.routesFor('OrderRequested')).toEqual([QUEUE.ordering]);
    expect(router.routesFor('CheckoutReadyForPayment')).toEqual([QUEUE.payments]);
  });

  it('every route target is a known queue name', () => {
    const known = new Set<string>(Object.values(QUEUE));
    for (const queues of Object.values(COMMERCE_EVENT_ROUTES)) {
      for (const q of queues) expect(known.has(q)).toBe(true);
    }
  });

  it('registration is idempotent (re-running does not duplicate queues)', () => {
    registerCommerceEventRoutes(router);
    expect(router.routesFor('OrderRequested')).toEqual([QUEUE.ordering]);
    expect(router.routesFor('CheckoutReadyForPayment')).toEqual([QUEUE.payments]);
  });

  it('builds one job per published event, keyed by eventId for at-least-once dedup', () => {
    const jobs = router.route({ eventId: 'evt-1', eventName: 'OrderRequested', payload: { a: 1 } });

    expect(jobs).toHaveLength(1);
    expect(jobs[0].queue).toBe(QUEUE.ordering);
    expect(jobs[0].jobId).toBe('evt-1');
    expect(jobs[0].payload).toEqual({ a: 1 });
  });
});
