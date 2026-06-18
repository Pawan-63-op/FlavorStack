// Engagement (Phase 3.B) — EngagementEventRoutes routing table tests.
//
// Engagement publishes three events, all PUBLISH-ONLY for now (engagement_module.md §3/§8): they are
// declared in the routing table but routed to NO queue (no consumer yet). Registration is additive and
// idempotent — it unions onto a shared router without clobbering other contexts' routes.
// Mirrors FulfillmentEventRoutes.test.ts.
import { EventRouter } from '../../../../infrastructure/outbox/EventRouter';
import {
  registerEngagementEventRoutes,
  ENGAGEMENT_EVENT_ROUTES,
} from '../../../../infrastructure/outbox/EngagementEventRoutes';
import { registerFulfillmentEventRoutes } from '../../../../infrastructure/outbox/FulfillmentEventRoutes';
import { QUEUE } from '../../../../config/bullmq';

const PUBLISHED = ['ReviewSubmitted', 'ReviewModerated', 'RestaurantRatingUpdated'] as const;

describe('Engagement event routes', () => {
  let router: EventRouter;

  beforeEach(() => {
    router = registerEngagementEventRoutes(new EventRouter());
  });

  it('declares each published event as a known route key', () => {
    for (const name of PUBLISHED) {
      expect(name in ENGAGEMENT_EVENT_ROUTES).toBe(true);
    }
  });

  it('routes every published event to NO queue (publish-only)', () => {
    for (const name of PUBLISHED) {
      expect(router.routesFor(name)).toEqual([]);
      // No queue target → has() is false, and a drained row produces zero enqueue jobs.
      expect(router.has(name)).toBe(false);
      expect(router.route({ eventId: 'e-1', eventName: name, payload: {} })).toEqual([]);
    }
  });

  it('registration is idempotent (re-running keeps the routes publish-only)', () => {
    registerEngagementEventRoutes(router);
    for (const name of PUBLISHED) {
      expect(router.routesFor(name)).toEqual([]);
    }
  });

  it('is additive — registering onto a router that already has Fulfillment routes keeps both', () => {
    const shared = new EventRouter();
    registerFulfillmentEventRoutes(shared);
    registerEngagementEventRoutes(shared);

    // Fulfillment's notification routes are untouched.
    expect(shared.routesFor('FulfillmentCreated')).toEqual([QUEUE.notification]);
    // Engagement's publish-only events are declared but parked.
    expect(shared.routesFor('ReviewSubmitted')).toEqual([]);
  });
});
