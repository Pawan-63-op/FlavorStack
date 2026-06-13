// Catalog event → queue routing table (Catalog Phase 12).
//
// The single place catalog declares where each of its published domain events
// fans out across the outbox→BullMQ spine. Mirrors the consumer map in the
// catalog blueprint §7 (Domain Events table) and §8 (Integration Points):
//
//   Commerce       — cart/order revalidation on price & availability changes,
//                    blocked ordering when a restaurant closes.
//   Fulfillment    — serviceability/assignment radius from delivery-zone changes.
//   Search-reindex — keep the search projections fresh on any catalog mutation.
//   Notification   — fire-and-forget owner/customer notifications (e.g. new
//                    restaurant near you).
//
// Wired into a shared EventRouter at startup; the OutboxPoller consults the router
// to enqueue drained rows. Registration is idempotent (the router unions queues).
import { QUEUE } from '../../config/bullmq';
import { EventRouter } from './EventRouter';

/** Catalog's declared event→queue fan-out. */
export const CATALOG_EVENT_ROUTES: Record<string, readonly string[]> = {
  // Restaurant aggregate
  RestaurantCreated: [QUEUE.searchReindex, QUEUE.notification],
  RestaurantUpdated: [QUEUE.searchReindex, QUEUE.commerce],
  RestaurantStatusChanged: [QUEUE.searchReindex, QUEUE.commerce],
  CategoryAdded: [QUEUE.searchReindex],
  CategoryUpdated: [QUEUE.searchReindex],
  DeliveryZoneChanged: [QUEUE.fulfillment],
  // MenuItem aggregate
  MenuItemCreated: [QUEUE.searchReindex],
  MenuItemUpdated: [QUEUE.searchReindex, QUEUE.commerce],
  MenuItemAvailabilityChanged: [QUEUE.searchReindex, QUEUE.commerce],
};

/** Register every catalog route on the shared router. Call once at startup. */
export function registerCatalogEventRoutes(router: EventRouter): EventRouter {
  for (const [eventName, queues] of Object.entries(CATALOG_EVENT_ROUTES)) {
    router.register(eventName, queues);
  }
  return router;
}
