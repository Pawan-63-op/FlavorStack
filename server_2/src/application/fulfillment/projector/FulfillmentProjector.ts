
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { ICustomerTrackingRepository } from '../../../domain/fulfillment/repositories/ICustomerTrackingRepository';
import { IFulfillmentCacheInvalidator } from '../../../domain/fulfillment/services/IFulfillmentCache';

interface FulfillmentCreatedExtended extends DomainEvent {
  orderRequestId: string;
  customerId: string;
  restaurantId: string;
  total: { amount: number; currency: string };
  lines?: Array<{
    menuItemId: string;
    name: string;
    quantity: number;
    lineTotal: { amount: number; currency: string };
  }>;
  deliveryAddress?: {
    label?: string;
    street: string;
    city: string;
    state: string;
    pinCode: string;
    coordinates: { lat: number; lng: number };
  };
}

interface PreparationStartedEvent extends DomainEvent {
  restaurantId: string;
  prepEstimateMinutes?: number;
}

interface ReadyForPickupEvent extends DomainEvent {
  restaurantId: string;
  readyAt: Date;
}

interface RiderAssignedEvent extends DomainEvent {
  riderId: string;
  assignedAt: Date;
}

interface PickupConfirmedEvent extends DomainEvent {
  riderId: string;
  pickedUpAt: Date;
}

interface OutForDeliveryEvent extends DomainEvent {
  riderId: string;
}

interface DeliveryCompletedEvent extends DomainEvent {
  riderId: string;
  deliveredAt: Date;
}

interface FulfillmentCancelledEvent extends DomainEvent {
  cancelledBy: string;
  reason: string;
  refundHint: { total: { amount: number; currency: string } };
}

interface DeliveryFailedEvent extends DomainEvent {
  riderId: string | null;
  failureReason: string;
}

interface RiderReassignedEvent extends DomainEvent {
  previousRiderId: string;
  newRiderId: string;
  attempt: number;
}

/**
 * Maintains `customer_tracking_views` — the one fulfillment read model that is not a copy of the
 * aggregate. Its `timeline[]` is append-only derived data the aggregate does not store, and it backs
 * the highest-traffic customer reads behind the Redis cache.
 *
 * Phase 3 removed the other three projections (`restaurant_fulfillment_views`, `rider_queue_views`,
 * `admin_dashboard_views`): every field they held was already on `fulfillments`, so the rider, owner
 * and admin reads now query the aggregate directly. `RiderOffered` went with them — it only ever
 * touched the rider queue and never invalidated the cache (an `OFFERED` assignment changes no
 * cached response field).
 *
 * @see architecture-simplify/Phase-3_Plan.md — Batch 5.
 */
export class FulfillmentProjector {
  constructor(
    private readonly trackingRepo: ICustomerTrackingRepository,
    private readonly cacheInvalidator?: IFulfillmentCacheInvalidator
  ) {}

  /**
   * Drop the read-side cache for a fulfillment AFTER its projection write has been applied, so the
   * next read repopulates from the up-to-date projection (Batch 9.1 ordering guarantee). Best-effort:
   * a cache failure must not break projection maintenance.
   */
  private async invalidateCache(fulfillmentId: string): Promise<void> {
    if (!this.cacheInvalidator) return;
    await this.cacheInvalidator.invalidateFulfillment(fulfillmentId);
  }

  async onFulfillmentCreated(event: DomainEvent): Promise<void> {
    const e = event as FulfillmentCreatedExtended;
    const fulfillmentId = e.aggregateId;
    const now = new Date();

    const address = e.deliveryAddress ?? {
      street: 'Unknown',
      city: '',
      state: '',
      pinCode: '',
      coordinates: { lat: 0, lng: 0 },
    };

    await this.trackingRepo.upsertCustomerTracking({
      fulfillmentId,
      eventId: e.eventId,
      set: {
        orderRequestId: e.orderRequestId,
        customerId: e.customerId,
        restaurantId: e.restaurantId,
        currentStatus: 'CREATED',
        deliveryStatus: 'UNASSIGNED',
        riderId: null,
        deliveryAddress: address,
        total: e.total,
        cancellation: null,
        failureReason: null,
      },
      timelineEntry: { eventId: e.eventId, status: 'CREATED', at: now },
    });

    await this.invalidateCache(fulfillmentId);
  }

  async onPreparationStarted(event: DomainEvent): Promise<void> {
    const e = event as PreparationStartedEvent;
    const fulfillmentId = e.aggregateId;
    const now = new Date();

    await this.trackingRepo.upsertCustomerTracking({
      fulfillmentId,
      eventId: e.eventId,
      set: { currentStatus: 'PREPARING' },
      timelineEntry: { eventId: e.eventId, status: 'PREPARING', at: now },
    });

    await this.invalidateCache(fulfillmentId);
  }

  async onReadyForPickup(event: DomainEvent): Promise<void> {
    const e = event as ReadyForPickupEvent;
    const fulfillmentId = e.aggregateId;

    await this.trackingRepo.upsertCustomerTracking({
      fulfillmentId,
      eventId: e.eventId,
      set: { currentStatus: 'READY_FOR_PICKUP' },
      timelineEntry: { eventId: e.eventId, status: 'READY_FOR_PICKUP', at: e.readyAt },
    });

    await this.invalidateCache(fulfillmentId);
  }

  async onRiderAssigned(event: DomainEvent): Promise<void> {
    const e = event as RiderAssignedEvent;
    const fulfillmentId = e.aggregateId;

    await this.trackingRepo.upsertCustomerTracking({
      fulfillmentId,
      eventId: e.eventId,
      set: { deliveryStatus: 'ASSIGNED', riderId: e.riderId },
      timelineEntry: {
        eventId: e.eventId,
        status: 'ASSIGNED',
        at: e.assignedAt,
        note: `Rider ${e.riderId} assigned`,
      },
    });

    await this.invalidateCache(fulfillmentId);
  }

  async onPickupConfirmed(event: DomainEvent): Promise<void> {
    const e = event as PickupConfirmedEvent;
    const fulfillmentId = e.aggregateId;

    await this.trackingRepo.upsertCustomerTracking({
      fulfillmentId,
      eventId: e.eventId,
      set: { currentStatus: 'PICKED_UP', deliveryStatus: 'PICKED_UP' },
      timelineEntry: { eventId: e.eventId, status: 'PICKED_UP', at: e.pickedUpAt },
    });

    await this.invalidateCache(fulfillmentId);
  }

  async onOutForDelivery(event: DomainEvent): Promise<void> {
    const e = event as OutForDeliveryEvent;
    const fulfillmentId = e.aggregateId;
    const now = new Date();

    await this.trackingRepo.upsertCustomerTracking({
      fulfillmentId,
      eventId: e.eventId,
      set: { currentStatus: 'OUT_FOR_DELIVERY', deliveryStatus: 'EN_ROUTE_TO_CUSTOMER' },
      timelineEntry: { eventId: e.eventId, status: 'OUT_FOR_DELIVERY', at: now },
    });

    await this.invalidateCache(fulfillmentId);
  }

  async onDeliveryCompleted(event: DomainEvent): Promise<void> {
    const e = event as DeliveryCompletedEvent;
    const fulfillmentId = e.aggregateId;

    await this.trackingRepo.upsertCustomerTracking({
      fulfillmentId,
      eventId: e.eventId,
      set: { currentStatus: 'DELIVERED', deliveryStatus: 'DELIVERED' },
      timelineEntry: { eventId: e.eventId, status: 'DELIVERED', at: e.deliveredAt },
    });

    await this.invalidateCache(fulfillmentId);
  }

  async onFulfillmentCancelled(event: DomainEvent): Promise<void> {
    const e = event as FulfillmentCancelledEvent;
    const fulfillmentId = e.aggregateId;
    const now = new Date();
    const cancellation = { cancelledBy: e.cancelledBy, reason: e.reason, at: now };

    await this.trackingRepo.upsertCustomerTracking({
      fulfillmentId,
      eventId: e.eventId,
      set: { currentStatus: 'CANCELLED', cancellation },
      timelineEntry: {
        eventId: e.eventId,
        status: 'CANCELLED',
        at: now,
        note: `Cancelled by ${e.cancelledBy}: ${e.reason}`,
      },
    });

    await this.invalidateCache(fulfillmentId);
  }

  async onDeliveryFailed(event: DomainEvent): Promise<void> {
    const e = event as DeliveryFailedEvent;
    const fulfillmentId = e.aggregateId;
    const now = new Date();

    await this.trackingRepo.upsertCustomerTracking({
      fulfillmentId,
      eventId: e.eventId,
      set: { currentStatus: 'FAILED', failureReason: e.failureReason },
      timelineEntry: { eventId: e.eventId, status: 'FAILED', at: now, note: e.failureReason },
    });

    await this.invalidateCache(fulfillmentId);
  }

  async onRiderReassigned(event: DomainEvent): Promise<void> {
    const e = event as RiderReassignedEvent;
    const fulfillmentId = e.aggregateId;
    const now = new Date();

    await this.trackingRepo.upsertCustomerTracking({
      fulfillmentId,
      eventId: e.eventId,
      set: { riderId: e.newRiderId },
      timelineEntry: {
        eventId: e.eventId,
        status: 'REASSIGNED',
        at: now,
        note: `Rider changed from ${e.previousRiderId} to ${e.newRiderId}`,
      },
    });

    await this.invalidateCache(fulfillmentId);
  }
}
