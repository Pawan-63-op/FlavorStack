// FulfillmentProjector — maintains the four fulfillment read models (fulfillment_module.md §11, Phase 6).
//
// Subscribes to all Fulfillment domain events on the in-process bus (post-commit, same process).
// Each handler does an idempotent upsert into the relevant projection collection(s).
//
// Projection event mapping table:
//
// Event                 | CustomerTracking | RestaurantView | RiderQueueView | AdminDashboard |
// ----------------------|-----------------|----------------|----------------|----------------|
// FulfillmentCreated    | create (base)   | upsert         | —              | upsert         |
// PreparationStarted    | timeline        | status update  | —              | status update  |
// ReadyForPickup        | timeline        | readyAt+status | —              | status update  |
// RiderOffered          | —               | —              | upsert offer   | —              |
// RiderAssigned         | timeline+rider  | —              | status update  | rider+status   |
// RiderAssignmentExpired| —               | —              | remove item    | —              |
// PickupConfirmed       | timeline        | —              | status update  | status update  |
// OutForDelivery        | timeline        | —              | status update  | status update  |
// DeliveryCompleted     | timeline        | remove         | remove all     | terminal       |
// FulfillmentCancelled  | timeline+cancel | remove         | remove all     | cancel+terminal|
// DeliveryFailed        | timeline+fail   | remove         | remove all     | fail+terminal  |
// RiderReassigned       | timeline        | —              | old→remove     | rider update   |

import { DomainEvent } from '../../../domain/shared/DomainEvent';
import {
  IFulfillmentProjectionRepository,
  RestaurantFulfillmentView,
  AdminDashboardView,
} from '../../../domain/fulfillment/repositories/IFulfillmentProjectionRepository';
import { IFulfillmentCacheInvalidator } from '../../../domain/fulfillment/services/IFulfillmentCache';

// Typed event shapes (narrowed from DomainEvent).
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

interface RiderOfferedEvent extends DomainEvent {
  riderId: string;
  attempt: number;
  expiresAt: Date;
}

interface RiderAssignedEvent extends DomainEvent {
  riderId: string;
  assignedAt: Date;
}

interface RiderAssignmentExpiredEvent extends DomainEvent {
  riderId: string;
  attempt: number;
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

export class FulfillmentProjector {
  constructor(
    private readonly projectionRepo: IFulfillmentProjectionRepository,
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

    const lines = (e.lines ?? []).map((l) => ({
      menuItemId: l.menuItemId,
      name: l.name,
      quantity: l.quantity,
      lineTotal: l.lineTotal,
    }));

    // Seed CustomerTrackingView.
    await this.projectionRepo.upsertCustomerTracking({
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

    // Seed RestaurantFulfillmentView.
    const restaurantView: RestaurantFulfillmentView = {
      fulfillmentId,
      restaurantId: e.restaurantId,
      customerId: e.customerId,
      orderRequestId: e.orderRequestId,
      status: 'CREATED',
      prepEstimateMinutes: null,
      lines,
      total: e.total,
      createdAt: now,
      readyAt: null,
      updatedAt: now,
    };
    await this.projectionRepo.upsertRestaurantView(restaurantView);

    // Seed AdminDashboardView.
    const adminView: AdminDashboardView = {
      fulfillmentId,
      orderRequestId: e.orderRequestId,
      customerId: e.customerId,
      restaurantId: e.restaurantId,
      status: 'CREATED',
      deliveryStatus: 'UNASSIGNED',
      riderId: null,
      createdAt: now,
      updatedAt: now,
      slaBreached: false,
      exceptionFlag: false,
      cancellation: null,
      failureReason: null,
      total: e.total,
    };
    await this.projectionRepo.upsertAdminView(adminView);

    await this.invalidateCache(fulfillmentId);
  }

  async onPreparationStarted(event: DomainEvent): Promise<void> {
    const e = event as PreparationStartedEvent;
    const fulfillmentId = e.aggregateId;
    const now = new Date();

    await this.projectionRepo.upsertCustomerTracking({
      fulfillmentId,
      eventId: e.eventId,
      set: { currentStatus: 'PREPARING' },
      timelineEntry: { eventId: e.eventId, status: 'PREPARING', at: now },
    });

    // Update RestaurantFulfillmentView status and prepEstimateMinutes.
    const rows = await this.projectionRepo.findRestaurantQueue(e.restaurantId);
    const row = rows.find((r) => r.fulfillmentId === fulfillmentId);
    if (row) {
      await this.projectionRepo.upsertRestaurantView({
        ...row,
        status: 'PREPARING',
        prepEstimateMinutes: e.prepEstimateMinutes ?? row.prepEstimateMinutes,
        updatedAt: now,
      });
    }

    await this.projectionRepo.patchAdminView(fulfillmentId, { status: 'PREPARING', updatedAt: now });

    await this.invalidateCache(fulfillmentId);
  }

  async onReadyForPickup(event: DomainEvent): Promise<void> {
    const e = event as ReadyForPickupEvent;
    const fulfillmentId = e.aggregateId;
    const now = new Date();

    await this.projectionRepo.upsertCustomerTracking({
      fulfillmentId,
      eventId: e.eventId,
      set: { currentStatus: 'READY_FOR_PICKUP' },
      timelineEntry: { eventId: e.eventId, status: 'READY_FOR_PICKUP', at: e.readyAt },
    });

    const rows = await this.projectionRepo.findRestaurantQueue(e.restaurantId);
    const row = rows.find((r) => r.fulfillmentId === fulfillmentId);
    if (row) {
      await this.projectionRepo.upsertRestaurantView({
        ...row,
        status: 'READY_FOR_PICKUP',
        readyAt: e.readyAt,
        updatedAt: now,
      });
    }

    await this.projectionRepo.patchAdminView(fulfillmentId, { status: 'READY_FOR_PICKUP', updatedAt: now });

    await this.invalidateCache(fulfillmentId);
  }

  async onRiderOffered(event: DomainEvent): Promise<void> {
    const e = event as RiderOfferedEvent;
    const fulfillmentId = e.aggregateId;
    const now = new Date();

    const tracking = await this.projectionRepo.findCustomerTracking(fulfillmentId);
    if (!tracking) return;

    await this.projectionRepo.upsertRiderQueueItem({
      riderId: e.riderId,
      fulfillmentId,
      assignmentStatus: 'OFFERED',
      attempt: e.attempt,
      expiresAt: e.expiresAt,
      restaurantId: tracking.restaurantId,
      deliveryAddress: tracking.deliveryAddress,
      total: tracking.total,
      fulfillmentStatus: tracking.currentStatus,
      offeredAt: now,
      updatedAt: now,
    });
  }

  async onRiderAssigned(event: DomainEvent): Promise<void> {
    const e = event as RiderAssignedEvent;
    const fulfillmentId = e.aggregateId;
    const now = new Date();

    await this.projectionRepo.upsertCustomerTracking({
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

    // Update the rider queue item from OFFERED → ACCEPTED.
    const queueItems = await this.projectionRepo.findRiderQueue(e.riderId);
    const item = queueItems.find((q) => q.fulfillmentId === fulfillmentId);
    if (item) {
      await this.projectionRepo.upsertRiderQueueItem({ ...item, assignmentStatus: 'ACCEPTED', updatedAt: now });
    }

    await this.projectionRepo.patchAdminView(fulfillmentId, {
      riderId: e.riderId,
      deliveryStatus: 'ASSIGNED',
      updatedAt: now,
    });

    await this.invalidateCache(fulfillmentId);
  }

  async onRiderAssignmentExpired(event: DomainEvent): Promise<void> {
    const e = event as RiderAssignmentExpiredEvent;
    await this.projectionRepo.removeRiderQueueItem(e.riderId, e.aggregateId);
  }

  async onPickupConfirmed(event: DomainEvent): Promise<void> {
    const e = event as PickupConfirmedEvent;
    const fulfillmentId = e.aggregateId;
    const now = new Date();

    await this.projectionRepo.upsertCustomerTracking({
      fulfillmentId,
      eventId: e.eventId,
      set: { currentStatus: 'PICKED_UP', deliveryStatus: 'PICKED_UP' },
      timelineEntry: { eventId: e.eventId, status: 'PICKED_UP', at: e.pickedUpAt },
    });

    const queueItems = await this.projectionRepo.findRiderQueue(e.riderId);
    const item = queueItems.find((q) => q.fulfillmentId === fulfillmentId);
    if (item) {
      await this.projectionRepo.upsertRiderQueueItem({
        ...item,
        fulfillmentStatus: 'PICKED_UP',
        updatedAt: now,
      });
    }

    await this.projectionRepo.patchAdminView(fulfillmentId, {
      status: 'PICKED_UP',
      deliveryStatus: 'PICKED_UP',
      updatedAt: now,
    });

    await this.invalidateCache(fulfillmentId);
  }

  async onOutForDelivery(event: DomainEvent): Promise<void> {
    const e = event as OutForDeliveryEvent;
    const fulfillmentId = e.aggregateId;
    const now = new Date();

    await this.projectionRepo.upsertCustomerTracking({
      fulfillmentId,
      eventId: e.eventId,
      set: { currentStatus: 'OUT_FOR_DELIVERY', deliveryStatus: 'EN_ROUTE_TO_CUSTOMER' },
      timelineEntry: { eventId: e.eventId, status: 'OUT_FOR_DELIVERY', at: now },
    });

    const queueItems = await this.projectionRepo.findRiderQueue(e.riderId);
    const item = queueItems.find((q) => q.fulfillmentId === fulfillmentId);
    if (item) {
      await this.projectionRepo.upsertRiderQueueItem({ ...item, fulfillmentStatus: 'OUT_FOR_DELIVERY', updatedAt: now });
    }

    await this.projectionRepo.patchAdminView(fulfillmentId, {
      status: 'OUT_FOR_DELIVERY',
      deliveryStatus: 'EN_ROUTE_TO_CUSTOMER',
      updatedAt: now,
    });

    await this.invalidateCache(fulfillmentId);
  }

  async onDeliveryCompleted(event: DomainEvent): Promise<void> {
    const e = event as DeliveryCompletedEvent;
    const fulfillmentId = e.aggregateId;
    const now = new Date();

    await this.projectionRepo.upsertCustomerTracking({
      fulfillmentId,
      eventId: e.eventId,
      set: { currentStatus: 'DELIVERED', deliveryStatus: 'DELIVERED' },
      timelineEntry: { eventId: e.eventId, status: 'DELIVERED', at: e.deliveredAt },
    });

    await this.projectionRepo.removeRestaurantView(fulfillmentId);
    await this.projectionRepo.removeAllRiderQueueItemsForFulfillment(fulfillmentId);

    await this.projectionRepo.patchAdminView(fulfillmentId, {
      status: 'DELIVERED',
      deliveryStatus: 'DELIVERED',
      updatedAt: now,
    });

    await this.invalidateCache(fulfillmentId);
  }

  async onFulfillmentCancelled(event: DomainEvent): Promise<void> {
    const e = event as FulfillmentCancelledEvent;
    const fulfillmentId = e.aggregateId;
    const now = new Date();
    const cancellation = { cancelledBy: e.cancelledBy, reason: e.reason, at: now };

    await this.projectionRepo.upsertCustomerTracking({
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

    await this.projectionRepo.removeRestaurantView(fulfillmentId);
    await this.projectionRepo.removeAllRiderQueueItemsForFulfillment(fulfillmentId);

    await this.projectionRepo.patchAdminView(fulfillmentId, {
      status: 'CANCELLED',
      cancellation,
      exceptionFlag: true,
      updatedAt: now,
    });

    await this.invalidateCache(fulfillmentId);
  }

  async onDeliveryFailed(event: DomainEvent): Promise<void> {
    const e = event as DeliveryFailedEvent;
    const fulfillmentId = e.aggregateId;
    const now = new Date();

    await this.projectionRepo.upsertCustomerTracking({
      fulfillmentId,
      eventId: e.eventId,
      set: { currentStatus: 'FAILED', failureReason: e.failureReason },
      timelineEntry: { eventId: e.eventId, status: 'FAILED', at: now, note: e.failureReason },
    });

    await this.projectionRepo.removeRestaurantView(fulfillmentId);
    await this.projectionRepo.removeAllRiderQueueItemsForFulfillment(fulfillmentId);

    await this.projectionRepo.patchAdminView(fulfillmentId, {
      status: 'FAILED',
      failureReason: e.failureReason,
      exceptionFlag: true,
      updatedAt: now,
    });

    await this.invalidateCache(fulfillmentId);
  }

  async onRiderReassigned(event: DomainEvent): Promise<void> {
    const e = event as RiderReassignedEvent;
    const fulfillmentId = e.aggregateId;
    const now = new Date();

    await this.projectionRepo.upsertCustomerTracking({
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

    // Remove old rider's queue entry (new rider entry is created by a subsequent RiderAssigned event).
    await this.projectionRepo.removeRiderQueueItem(e.previousRiderId, fulfillmentId);

    await this.projectionRepo.patchAdminView(fulfillmentId, { riderId: e.newRiderId, updatedAt: now });

    await this.invalidateCache(fulfillmentId);
  }
}
