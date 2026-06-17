// Single place that wires all Fulfillment in-process subscriptions (fulfillment_module.md §5.3 / §6.3),
// mirroring registerCommerceCatalogProjector / registerIdentityEventHandlers. The shared in-process bus
// is what OutboxProcessor publishes drained outbox rows onto.
//
//  - OnOrderRequested (Phase 1): Commerce's OrderRequested → CreateFulfillment.
//  - OnReadyForPickup (Phase 3B): own ReadyForPickup → auto-offer the next rider.
//  - FulfillmentTimeoutScheduler (Phase 5B, optional): arm BullMQ delayed jobs on RiderOffered /
//    ReadyForPickup / OutForDelivery. Only wired when a scheduler (Redis) is available.
//  - FulfillmentProjector (Phase 6): maintain read-model projections from domain events.
//  - TrackingStatusBridge (Phase 7, optional): re-broadcast status events to the tracking room as
//    `tracking:status`. Only wired when a realtime broadcaster is available (the API process).
//  - FulfillmentNotificationDispatcher (Phase 8, optional): turn customer/rider-facing status events
//    into push notification jobs. Only wired when an INotificationQueue is available.
import { IEventBus } from '../../shared/events/IEventBus';
import { OnOrderRequested } from './OnOrderRequested';
import { OnReadyForPickup } from './OnReadyForPickup';
import { FulfillmentTimeoutScheduler } from './FulfillmentTimeoutScheduler';
import { TrackingStatusBridge, TRACKING_STATUS_EVENTS } from './TrackingStatusBridge';
import { FulfillmentNotificationDispatcher } from './FulfillmentNotificationDispatcher';
import { FULFILLMENT_NOTIFICATION_EVENTS } from './FulfillmentNotificationMapper';
import { FulfillmentProjector } from '../projector/FulfillmentProjector';
import { registerFulfillmentProjector } from '../projector/FulfillmentProjectionRegistry';

export function registerFulfillmentEventHandlers(
  eventBus: IEventBus,
  onOrderRequested: OnOrderRequested,
  onReadyForPickup: OnReadyForPickup,
  timeoutScheduler?: FulfillmentTimeoutScheduler,
  projector?: FulfillmentProjector,
  trackingStatusBridge?: TrackingStatusBridge,
  notificationDispatcher?: FulfillmentNotificationDispatcher
): void {
  eventBus.subscribe('OrderRequested', (event) => onOrderRequested.handle(event));
  eventBus.subscribe('ReadyForPickup', (event) => onReadyForPickup.handle(event));

  if (timeoutScheduler) {
    eventBus.subscribe('RiderOffered', (event) => timeoutScheduler.onRiderOffered(event));
    eventBus.subscribe('ReadyForPickup', (event) => timeoutScheduler.onReadyForPickup(event));
    eventBus.subscribe('OutForDelivery', (event) => timeoutScheduler.onOutForDelivery(event));
  }

  if (projector) {
    registerFulfillmentProjector(eventBus, projector);
  }

  if (trackingStatusBridge) {
    for (const eventName of TRACKING_STATUS_EVENTS) {
      eventBus.subscribe(eventName, (event) => trackingStatusBridge.handle(event));
    }
  }

  if (notificationDispatcher) {
    for (const eventName of FULFILLMENT_NOTIFICATION_EVENTS) {
      eventBus.subscribe(eventName, (event) => notificationDispatcher.handle(event));
    }
  }
}
