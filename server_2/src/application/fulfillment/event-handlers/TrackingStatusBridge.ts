import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { ITrackingBroadcaster } from '../ports/ITrackingBroadcaster';

/**
 * Maps each customer-visible domain event to the canonical status string the
 * tracking read model exposes — the same values `GET /fulfillments/:id/tracking`
 * puts in `currentStatus`/timeline (`FULFILLMENT_STATUS` lifecycle states, plus
 * the `ASSIGNED`/`REASSIGNED` rider milestones the projector writes to the
 * timeline). Broadcasting the raw `eventName` (e.g. `FulfillmentCancelled`) made
 * clients fold an unrecognised string and render "Unknown" until the HTTP
 * refetch corrected it; emitting the canonical status keeps the live socket and
 * the HTTP view in lock-step.
 */
const EVENT_TO_STATUS: Readonly<Record<string, string>> = {
  FulfillmentCreated: 'CREATED',
  PreparationStarted: 'PREPARING',
  ReadyForPickup: 'READY_FOR_PICKUP',
  RiderAssigned: 'ASSIGNED',
  PickupConfirmed: 'PICKED_UP',
  OutForDelivery: 'OUT_FOR_DELIVERY',
  DeliveryCompleted: 'DELIVERED',
  FulfillmentCancelled: 'CANCELLED',
  DeliveryFailed: 'FAILED',
  RiderReassigned: 'REASSIGNED',
};

/** Domain events that represent a customer-visible status change for the tracking room. */
export const TRACKING_STATUS_EVENTS: readonly string[] = Object.keys(EVENT_TO_STATUS);

export class TrackingStatusBridge {
  constructor(private readonly broadcaster: ITrackingBroadcaster) {}

  async handle(event: DomainEvent): Promise<void> {
    const fulfillmentId = event.aggregateId;
    const riderId = (event as { riderId?: string | null }).riderId ?? null;

    this.broadcaster.broadcastStatus(fulfillmentId, {
      fulfillmentId,
      status: EVENT_TO_STATUS[event.eventName] ?? event.eventName,
      at: event.occurredOn instanceof Date ? event.occurredOn.toISOString() : new Date().toISOString(),
      riderId,
    });
  }
}
