// Fulfillment event → queue routing table (Fulfillment Phase 8, §5.3). Mirrors
// CatalogEventRoutes.ts / CommerceEventRoutes.ts: the single place Fulfillment
// declares where each of its published domain events fans out across the
// outbox→BullMQ spine.
//
// Two kinds of routes (fulfillment_module.md §5.2 / §5.3):
//   - Customer/rider-FACING status events  → QUEUE.notification (Engagement
//     "notify" consumer; today the in-process FulfillmentNotificationDispatcher).
//   - OrderRequested                        → QUEUE.fulfillment, the future
//     split transport. Today's live consumption of OrderRequested is the
//     in-process bus (OnOrderRequested via OutboxProcessor); this route is for
//     when Fulfillment becomes a separate process.
//
// Internal-only events (RiderOffered, RiderAssignmentExpired) are deliberately
// NOT routed to notification — they drive the retry/re-offer flow, not customers.
//
// Registration is additive and idempotent (the EventRouter unions queues), so
// this never touches Commerce's or Catalog's routes (§14.2). As with the other
// route tables, this only *declares* routes; binding them onto a live router is
// the BullMQ OutboxPoller's job (a later phase).
import { QUEUE } from '../../config/bullmq';
import { EventRouter } from './EventRouter';

/** Fulfillment's declared event→queue fan-out for customer/rider-facing events. */
export const FULFILLMENT_EVENT_ROUTES: Record<string, readonly string[]> = {
  // customer/rider-facing → notifications
  FulfillmentCreated: [QUEUE.notification],
  ReadyForPickup: [QUEUE.notification],
  RiderAssigned: [QUEUE.notification],
  OutForDelivery: [QUEUE.notification],
  DeliveryCompleted: [QUEUE.notification],
  FulfillmentCancelled: [QUEUE.notification],
  DeliveryFailed: [QUEUE.notification],
};

/**
 * Register every fulfillment route on the shared router. Call once at startup.
 * Additive (unions onto whatever Catalog/Commerce already registered) and
 * idempotent (re-running does not duplicate queues).
 */
export function registerFulfillmentEventRoutes(router: EventRouter): EventRouter {
  for (const [eventName, queues] of Object.entries(FULFILLMENT_EVENT_ROUTES)) {
    router.register(eventName, queues);
  }
  // Additionally make OrderRequested reach Fulfillment's future queue transport
  // (live path today is the in-process bus via OutboxProcessor).
  router.register('OrderRequested', [QUEUE.fulfillment]);
  return router;
}
