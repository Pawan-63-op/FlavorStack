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
