// Realtime status bridge (fulfillment_module.md §9, Phase 7).
//
// A thin reactor that subscribes to fulfillment status domain events on the in-process bus and
// re-broadcasts them as `tracking:status` to the order's room — DECOUPLED from the write path
// (the use cases that publish these events know nothing about realtime). Customers watching a
// room get a live status timeline without polling.
//
// The set of bridged events mirrors the customer-visible lifecycle (§5.2). GPS pings are handled
// separately by RecordRiderLocation (§9); this bridge is only for coarse status changes.
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { ITrackingBroadcaster } from '../ports/ITrackingBroadcaster';

/** Domain events that represent a customer-visible status change for the tracking room. */
export const TRACKING_STATUS_EVENTS: readonly string[] = [
  'FulfillmentCreated',
  'PreparationStarted',
  'ReadyForPickup',
  'RiderAssigned',
  'PickupConfirmed',
  'OutForDelivery',
  'DeliveryCompleted',
  'FulfillmentCancelled',
  'DeliveryFailed',
  'RiderReassigned',
];

export class TrackingStatusBridge {
  constructor(private readonly broadcaster: ITrackingBroadcaster) {}

  async handle(event: DomainEvent): Promise<void> {
    const fulfillmentId = event.aggregateId;
    // riderId rides on most rider-leg events; absent on prep/cancel events.
    const riderId = (event as { riderId?: string | null }).riderId ?? null;

    this.broadcaster.broadcastStatus(fulfillmentId, {
      fulfillmentId,
      status: event.eventName,
      at: event.occurredOn instanceof Date ? event.occurredOn.toISOString() : new Date().toISOString(),
      riderId,
    });
  }
}
