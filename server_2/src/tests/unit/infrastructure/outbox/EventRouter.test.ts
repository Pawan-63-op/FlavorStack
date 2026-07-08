import { EventRouter } from '../../../../infrastructure/outbox/EventRouter';
import {
  registerCatalogEventRoutes,
  CATALOG_EVENT_ROUTES,
} from '../../../../infrastructure/outbox/CatalogEventRoutes';
import { QUEUE } from '../../../../config/bullmq';
import { CATALOG_EVENT_NAMES } from '../../../../application/catalog/contracts/CatalogEventContracts';

describe('EventRouter', () => {
  it('registers and resolves routes', () => {
    const router = new EventRouter();
    router.register('Foo', [QUEUE.commerce, QUEUE.searchReindex]);

    expect(router.has('Foo')).toBe(true);
    expect(router.routesFor('Foo').sort()).toEqual([QUEUE.commerce, QUEUE.searchReindex].sort());
  });

  it('unions queues on repeated registration (idempotent, order-independent)', () => {
    const router = new EventRouter();
    router.register('Foo', [QUEUE.commerce]);
    router.register('Foo', [QUEUE.commerce, QUEUE.searchReindex]);

    expect(router.routesFor('Foo').sort()).toEqual([QUEUE.commerce, QUEUE.searchReindex].sort());
  });

  it('returns no routes / no jobs for an unrouted event', () => {
    const router = new EventRouter();
    expect(router.has('Unknown')).toBe(false);
    expect(router.routesFor('Unknown')).toEqual([]);
    expect(router.route({ eventId: 'e1', eventName: 'Unknown', payload: {} })).toEqual([]);
  });

  it('builds one job per target queue, each keyed by eventId for dedup', () => {
    const router = new EventRouter();
    router.register('Foo', [QUEUE.commerce, QUEUE.searchReindex]);

    const jobs = router.route({ eventId: 'evt-42', eventName: 'Foo', payload: { a: 1 } });

    expect(jobs).toHaveLength(2);
    for (const job of jobs) {
      expect(job.jobId).toBe('evt-42');
      expect(job.eventName).toBe('Foo');
      expect(job.payload).toEqual({ a: 1 });
    }
    expect(jobs.map((j) => j.queue).sort()).toEqual([QUEUE.commerce, QUEUE.searchReindex].sort());
  });
});

describe('Catalog event routes', () => {
  let router: EventRouter;

  beforeEach(() => {
    router = registerCatalogEventRoutes(new EventRouter());
  });

  it('routes every published catalog event to at least one queue', () => {
    for (const name of CATALOG_EVENT_NAMES) {
      expect(router.has(name)).toBe(true);
      expect(router.routesFor(name).length).toBeGreaterThan(0);
    }
  });

  it('routes per the blueprint consumer map', () => {
    expect(router.routesFor('MenuItemAvailabilityChanged').sort()).toEqual(
      [QUEUE.commerce, QUEUE.searchReindex].sort()
    );
    expect(router.routesFor('RestaurantStatusChanged').sort()).toEqual(
      [QUEUE.commerce, QUEUE.searchReindex].sort()
    );
    expect(router.routesFor('DeliveryZoneChanged')).toEqual([QUEUE.fulfillment]);
    expect(router.routesFor('RestaurantCreated').sort()).toEqual(
      [QUEUE.notification, QUEUE.searchReindex].sort()
    );
    expect(router.routesFor('MenuItemCreated')).toEqual([QUEUE.searchReindex]);
  });

  it('every route target is a known queue name', () => {
    const known = new Set<string>(Object.values(QUEUE));
    for (const queues of Object.values(CATALOG_EVENT_ROUTES)) {
      for (const q of queues) expect(known.has(q)).toBe(true);
    }
  });

  it('registration is idempotent (re-running does not duplicate queues)', () => {
    registerCatalogEventRoutes(router);
    expect(router.routesFor('MenuItemUpdated').sort()).toEqual(
      [QUEUE.commerce, QUEUE.searchReindex].sort()
    );
  });
});
