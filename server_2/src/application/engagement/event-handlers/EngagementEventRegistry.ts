// Single place that wires all Engagement in-process subscriptions (engagement_module.md §4), mirroring
// registerFulfillmentEventHandlers. The shared in-process bus is what OutboxProcessor publishes drained
// outbox rows onto; this registry must be invoked at bootstrap BEFORE the outbox processor starts so no
// committed cross-context event is missed.
//
// Engagement consumes nine events from Identity + Fulfillment. Each handler is idempotent and best-effort
// (logs failures, leaves the eventId unmarked so the outbox retries) — see the individual handlers.
import { IEventBus } from '../../shared/events/IEventBus';
import { OnUserRegistered } from './OnUserRegistered';
import { OnPasswordChanged } from './OnPasswordChanged';
import { OnPasswordResetRequested } from './OnPasswordResetRequested';
import { OnFulfillmentCreated } from './OnFulfillmentCreated';
import { OnReadyForPickup } from './OnReadyForPickup';
import { OnRiderAssigned } from './OnRiderAssigned';
import { OnOutForDelivery } from './OnOutForDelivery';
import { OnDeliveryCompleted } from './OnDeliveryCompleted';
import { OnFulfillmentCancelled } from './OnFulfillmentCancelled';

export interface EngagementEventHandlers {
  onUserRegistered: OnUserRegistered;
  onPasswordChanged: OnPasswordChanged;
  onPasswordResetRequested: OnPasswordResetRequested;
  onFulfillmentCreated: OnFulfillmentCreated;
  onReadyForPickup: OnReadyForPickup;
  onRiderAssigned: OnRiderAssigned;
  onOutForDelivery: OnOutForDelivery;
  onDeliveryCompleted: OnDeliveryCompleted;
  onFulfillmentCancelled: OnFulfillmentCancelled;
}

export function registerEngagementEventHandlers(eventBus: IEventBus, handlers: EngagementEventHandlers): void {
  // Identity events.
  eventBus.subscribe('UserRegistered', (event) => handlers.onUserRegistered.handle(event));
  eventBus.subscribe('PasswordChanged', (event) => handlers.onPasswordChanged.handle(event));
  eventBus.subscribe('PasswordResetRequested', (event) => handlers.onPasswordResetRequested.handle(event));

  // Fulfillment events.
  eventBus.subscribe('FulfillmentCreated', (event) => handlers.onFulfillmentCreated.handle(event));
  eventBus.subscribe('ReadyForPickup', (event) => handlers.onReadyForPickup.handle(event));
  eventBus.subscribe('RiderAssigned', (event) => handlers.onRiderAssigned.handle(event));
  eventBus.subscribe('OutForDelivery', (event) => handlers.onOutForDelivery.handle(event));
  eventBus.subscribe('DeliveryCompleted', (event) => handlers.onDeliveryCompleted.handle(event));
  eventBus.subscribe('FulfillmentCancelled', (event) => handlers.onFulfillmentCancelled.handle(event));
}
