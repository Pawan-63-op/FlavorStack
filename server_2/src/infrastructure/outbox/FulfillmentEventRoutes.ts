import { QUEUE } from '../../config/bullmq';
import { EventRouter } from './EventRouter';

/** Fulfillment's declared event→queue fan-out for customer/rider-facing events. */
export const FULFILLMENT_EVENT_ROUTES: Record<string, readonly string[]> = {
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
  router.register('OrderRequested', [QUEUE.fulfillment]);
  return router;
}
