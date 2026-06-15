// Commerce event → queue routing table (Commerce Phase 12). Mirrors CatalogEventRoutes.ts: the single place
// Commerce declares where each of its published domain events fans out across the outbox→BullMQ spine.
//
// Commerce publishes exactly two events at a successful checkout (commerce_module.md §8.1):
//   OrderRequested          → future Ordering   (the immutable order request)
//   CheckoutReadyForPayment → future Payments   (payment intent + amount)
//
// Both are PUBLISH-AND-PARK: the consuming contexts don't exist yet, so the routes point at parked queue
// names (QUEUE.ordering / QUEUE.payments) with no worker draining them. Rows persist in outbox_events with no
// data loss; when Ordering/Payments are built they attach a consumer with zero Commerce change.
//
// Registration is idempotent (the EventRouter unions queues). As with CatalogEventRoutes, this only *declares*
// the routes; binding them onto a live router is the BullMQ OutboxPoller's job (a later phase) — the current
// OutboxProcessor publishes drained rows onto the in-process bus, where these parked events simply have no
// subscriber.
import { QUEUE } from '../../config/bullmq';
import { EventRouter } from './EventRouter';

/** Commerce's published outbox events — the source of truth for the routing table below. */
export const COMMERCE_OUTBOX_EVENT_NAMES = ['OrderRequested', 'CheckoutReadyForPayment'] as const;

/** Commerce's declared event→queue fan-out. */
export const COMMERCE_EVENT_ROUTES: Record<string, readonly string[]> = {
  OrderRequested: [QUEUE.ordering],
  CheckoutReadyForPayment: [QUEUE.payments],
};

/** Register every commerce route on the shared router. Call once at startup. */
export function registerCommerceEventRoutes(router: EventRouter): EventRouter {
  for (const [eventName, queues] of Object.entries(COMMERCE_EVENT_ROUTES)) {
    router.register(eventName, queues);
  }
  return router;
}
