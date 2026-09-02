import { IEventBus } from '../../shared/events/IEventBus';
import { OnReadyForPickup } from './OnReadyForPickup';
import { FulfillmentTimeoutScheduler } from './FulfillmentTimeoutScheduler';
import { TrackingStatusBridge, TRACKING_STATUS_EVENTS } from './TrackingStatusBridge';
import { FulfillmentProjector } from '../projector/FulfillmentProjector';
import { registerFulfillmentProjector } from '../projector/FulfillmentProjectionRegistry';

/**
 * Phase 7.3: `OrderRequested` is deliberately absent. Its only delivery path is the outbox relay
 * (OutboxProcessor → OutboxDispatcher → OnOrderRequested), so subscribing here would restore the
 * double delivery the phase removed.
 */
export function registerFulfillmentEventHandlers(
  eventBus: IEventBus,
  onReadyForPickup: OnReadyForPickup,
  timeoutScheduler?: FulfillmentTimeoutScheduler,
  projector?: FulfillmentProjector,
  trackingStatusBridge?: TrackingStatusBridge
): void {
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
}
