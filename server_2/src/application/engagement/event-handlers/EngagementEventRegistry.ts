import { IEventBus } from '../../shared/events/IEventBus';
import { OnUserRegistered } from './OnUserRegistered';
import { OnFulfillmentCreated } from './OnFulfillmentCreated';
import { OnReadyForPickup } from './OnReadyForPickup';
import { OnRiderAssigned } from './OnRiderAssigned';
import { OnOutForDelivery } from './OnOutForDelivery';
import { OnDeliveryCompleted } from './OnDeliveryCompleted';
import { OnFulfillmentCancelled } from './OnFulfillmentCancelled';

export interface EngagementEventHandlers {
  onUserRegistered: OnUserRegistered;
  onFulfillmentCreated: OnFulfillmentCreated;
  onReadyForPickup: OnReadyForPickup;
  onRiderAssigned: OnRiderAssigned;
  onOutForDelivery: OnOutForDelivery;
  onDeliveryCompleted: OnDeliveryCompleted;
  onFulfillmentCancelled: OnFulfillmentCancelled;
}

export function registerEngagementEventHandlers(eventBus: IEventBus, handlers: EngagementEventHandlers): void {
  eventBus.subscribe('UserRegistered', (event) => handlers.onUserRegistered.handle(event));

  eventBus.subscribe('FulfillmentCreated', (event) => handlers.onFulfillmentCreated.handle(event));
  eventBus.subscribe('ReadyForPickup', (event) => handlers.onReadyForPickup.handle(event));
  eventBus.subscribe('RiderAssigned', (event) => handlers.onRiderAssigned.handle(event));
  eventBus.subscribe('OutForDelivery', (event) => handlers.onOutForDelivery.handle(event));
  eventBus.subscribe('DeliveryCompleted', (event) => handlers.onDeliveryCompleted.handle(event));
  eventBus.subscribe('FulfillmentCancelled', (event) => handlers.onFulfillmentCancelled.handle(event));
}
