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
