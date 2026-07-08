import { QUEUE } from '../../config/bullmq';
import { EventRouter } from './EventRouter';

/** Catalog's declared event→queue fan-out. */
export const CATALOG_EVENT_ROUTES: Record<string, readonly string[]> = {
  RestaurantCreated: [QUEUE.searchReindex, QUEUE.notification],
  RestaurantUpdated: [QUEUE.searchReindex, QUEUE.commerce],
  RestaurantStatusChanged: [QUEUE.searchReindex, QUEUE.commerce],
  CategoryAdded: [QUEUE.searchReindex],
  CategoryUpdated: [QUEUE.searchReindex],
  DeliveryZoneChanged: [QUEUE.fulfillment],
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
