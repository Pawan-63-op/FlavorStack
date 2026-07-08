import { IEventBus } from '../../shared/events/IEventBus';
import { FulfillmentProjector } from './FulfillmentProjector';

export function registerFulfillmentProjector(eventBus: IEventBus, projector: FulfillmentProjector): void {
  eventBus.subscribe('FulfillmentCreated', (e) => projector.onFulfillmentCreated(e));
  eventBus.subscribe('PreparationStarted', (e) => projector.onPreparationStarted(e));
  eventBus.subscribe('ReadyForPickup', (e) => projector.onReadyForPickup(e));
  eventBus.subscribe('RiderOffered', (e) => projector.onRiderOffered(e));
  eventBus.subscribe('RiderAssigned', (e) => projector.onRiderAssigned(e));
  eventBus.subscribe('RiderAssignmentExpired', (e) => projector.onRiderAssignmentExpired(e));
  eventBus.subscribe('PickupConfirmed', (e) => projector.onPickupConfirmed(e));
  eventBus.subscribe('OutForDelivery', (e) => projector.onOutForDelivery(e));
  eventBus.subscribe('DeliveryCompleted', (e) => projector.onDeliveryCompleted(e));
  eventBus.subscribe('FulfillmentCancelled', (e) => projector.onFulfillmentCancelled(e));
  eventBus.subscribe('DeliveryFailed', (e) => projector.onDeliveryFailed(e));
  eventBus.subscribe('RiderReassigned', (e) => projector.onRiderReassigned(e));
}
