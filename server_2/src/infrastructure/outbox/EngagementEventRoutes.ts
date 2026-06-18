// Engagement event → queue routing table (engagement_module.md §8). Mirrors
// FulfillmentEventRoutes.ts / CommerceEventRoutes.ts / CatalogEventRoutes.ts: the
// single place Engagement declares where each of its published domain events fans
// out across the outbox→BullMQ spine.
//
// Engagement's three published events are PUBLISH-ONLY for now (engagement_module.md
// §3 / §8): they are persisted to the outbox and addressable, but routed to NO queue
// because no consumer exists yet.
//   - ReviewSubmitted          → []  (future moderation/analytics consumer)
//   - ReviewModerated          → []  (future analytics consumer)
//   - RestaurantRatingUpdated  → []  (future Catalog consumer; §4 keeps Catalog out of scope)
//
// Declaring them with an explicit empty target documents the intent (an event that is
// known but deliberately parked) and keeps the routing table the single source of truth
// for "what Engagement publishes".
//
// Registration is additive and idempotent (the EventRouter unions queues), so this never
// touches Commerce's / Catalog's / Fulfillment's routes. As with the other route tables,
// this only *declares* routes; binding them onto a live router is the BullMQ OutboxPoller's
// job (a later phase) — Engagement, like the other contexts, does not wire a router into
// bootstrap today.
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
