import { EventRouter } from './EventRouter';

/** Engagement's declared event→queue fan-out. All publish-only (no queue) today. */
export const ENGAGEMENT_EVENT_ROUTES: Record<string, readonly string[]> = {
  ReviewSubmitted: [],
  ReviewModerated: [],
  RestaurantRatingUpdated: [],
};

/**
 * Register every engagement route on the shared router. Call once at startup.
 * Additive (unions onto whatever other contexts already registered) and idempotent
 * (re-running does not duplicate queues). Publish-only events are declared with an
 * empty target set, so `router.has(name)` stays `false` while the name remains a
 * documented, addressable route.
 */
export function registerEngagementEventRoutes(router: EventRouter): EventRouter {
  for (const [eventName, queues] of Object.entries(ENGAGEMENT_EVENT_ROUTES)) {
    router.register(eventName, queues);
  }
  return router;
}
