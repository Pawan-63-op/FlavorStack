import { IEventBus } from '../../shared/events/IEventBus';
import { FulfillmentProjector } from './FulfillmentProjector';

export function registerFulfillmentProjector(eventBus: IEventBus, projector: FulfillmentProjector): void {
  eventBus.subscribe('FulfillmentCreated', (e) => projector.onFulfillmentCreated(e));
  eventBus.subscribe('PreparationStarted', (e) => projector.onPreparationStarted(e));
  eventBus.subscribe('ReadyForPickup', (e) => projector.onReadyForPickup(e));
  // RiderOffered is deliberately absent: it only ever wrote rider_queue_views, which Phase 3
  // retired, and an OFFERED assignment changes no customer-tracking field or cached response.
  eventBus.subscribe('RiderAssigned', (e) => projector.onRiderAssigned(e));
  eventBus.subscribe('PickupConfirmed', (e) => projector.onPickupConfirmed(e));
  eventBus.subscribe('OutForDelivery', (e) => projector.onOutForDelivery(e));
  eventBus.subscribe('DeliveryCompleted', (e) => projector.onDeliveryCompleted(e));
  eventBus.subscribe('FulfillmentCancelled', (e) => projector.onFulfillmentCancelled(e));
  eventBus.subscribe('DeliveryFailed', (e) => projector.onDeliveryFailed(e));
  eventBus.subscribe('RiderReassigned', (e) => projector.onRiderReassigned(e));
}
