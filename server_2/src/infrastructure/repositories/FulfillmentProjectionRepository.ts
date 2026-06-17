// MongoFulfillmentProjectionRepository — implements IFulfillmentProjectionRepository (Phase 6).
// Plain (session-less) Mongo writes — projections are updated post-commit by the FulfillmentProjector.
// All write methods are idempotent via upsert; customer tracking uses processedEventIds to deduplicate.
import {
  IFulfillmentProjectionRepository,
  CustomerTrackingView,
  RestaurantFulfillmentView,
  RiderQueueView,
  AdminDashboardView,
  AdminDashboardQuery,
  TrackingTimelineEntry,
} from '../../domain/fulfillment/repositories/IFulfillmentProjectionRepository';
import {
  CustomerTrackingViewModel,
  CustomerTrackingViewDocument,
} from '../database/models/CustomerTrackingViewModel';
import {
  RestaurantFulfillmentViewModel,
  RestaurantFulfillmentViewDocument,
} from '../database/models/RestaurantFulfillmentViewModel';
import {
  RiderQueueViewModel,
  RiderQueueViewDocument,
} from '../database/models/RiderQueueViewModel';
import {
  AdminDashboardViewModel,
  AdminDashboardViewDocument,
} from '../database/models/AdminDashboardViewModel';

function riderQueueId(riderId: string, fulfillmentId: string): string {
  return `${riderId}:${fulfillmentId}`;
}

function docToCustomerTracking(doc: CustomerTrackingViewDocument): CustomerTrackingView {
  return {
    fulfillmentId: doc._id,
    orderRequestId: doc.orderRequestId,
    customerId: doc.customerId,
    restaurantId: doc.restaurantId,
    currentStatus: doc.currentStatus,
    deliveryStatus: doc.deliveryStatus,
    riderId: doc.riderId,
    timeline: doc.timeline.map((t) => ({ eventId: t.eventId, status: t.status, at: t.at, note: t.note })),
    deliveryAddress: doc.deliveryAddress as CustomerTrackingView['deliveryAddress'],
    total: doc.total,
    cancellation: doc.cancellation ?? null,
    failureReason: doc.failureReason,
    updatedAt: doc.updatedAt,
  };
}

function docToRestaurantView(doc: RestaurantFulfillmentViewDocument): RestaurantFulfillmentView {
  return {
    fulfillmentId: doc._id,
    restaurantId: doc.restaurantId,
    customerId: doc.customerId,
    orderRequestId: doc.orderRequestId,
    status: doc.status,
    prepEstimateMinutes: doc.prepEstimateMinutes,
    lines: doc.lines.map((l) => ({
      menuItemId: l.menuItemId,
      name: l.name,
      quantity: l.quantity,
      lineTotal: l.lineTotal,
    })),
    total: doc.total,
    createdAt: doc.createdAt,
    readyAt: doc.readyAt,
    updatedAt: doc.updatedAt,
  };
}

function docToRiderQueue(doc: RiderQueueViewDocument): RiderQueueView {
  return {
    riderId: doc.riderId,
    fulfillmentId: doc.fulfillmentId,
    assignmentStatus: doc.assignmentStatus,
    attempt: doc.attempt,
    expiresAt: doc.expiresAt,
    restaurantId: doc.restaurantId,
    deliveryAddress: doc.deliveryAddress as RiderQueueView['deliveryAddress'],
    total: doc.total,
    fulfillmentStatus: doc.fulfillmentStatus,
    offeredAt: doc.offeredAt,
    updatedAt: doc.updatedAt,
  };
}

function docToAdminView(doc: AdminDashboardViewDocument): AdminDashboardView {
  return {
    fulfillmentId: doc._id,
    orderRequestId: doc.orderRequestId,
    customerId: doc.customerId,
    restaurantId: doc.restaurantId,
    status: doc.status,
    deliveryStatus: doc.deliveryStatus,
    riderId: doc.riderId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    slaBreached: doc.slaBreached,
    exceptionFlag: doc.exceptionFlag,
    cancellation: doc.cancellation ?? null,
    failureReason: doc.failureReason,
    total: doc.total,
  };
}

export class MongoFulfillmentProjectionRepository implements IFulfillmentProjectionRepository {
  // ── CustomerTrackingView ─────────────────────────────────────────

  async upsertCustomerTracking(params: {
    fulfillmentId: string;
    eventId: string;
    set: Partial<Omit<CustomerTrackingView, 'fulfillmentId' | 'timeline'>>;
    timelineEntry: TrackingTimelineEntry;
  }): Promise<void> {
    const { fulfillmentId, eventId, set, timelineEntry } = params;

    // $set the current state fields + $addToSet the eventId (dedup guard).
    // On first insert (upsert creates the doc), only $set fields are written;
    // processedEventIds and timeline are initialized by $addToSet/$push below.
    await CustomerTrackingViewModel.updateOne(
      { _id: fulfillmentId },
      {
        $set: { ...set, updatedAt: new Date() },
        $addToSet: { processedEventIds: eventId },
      },
      { upsert: true }
    );

    // Push timeline entry only when the eventId was not already in the timeline
    // (checks 'timeline.eventId' to guard against at-least-once redelivery).
    await CustomerTrackingViewModel.updateOne(
      { _id: fulfillmentId, 'timeline.eventId': { $ne: eventId } },
      { $push: { timeline: timelineEntry } }
    );
  }

  async findCustomerTracking(fulfillmentId: string): Promise<CustomerTrackingView | null> {
    const doc = await CustomerTrackingViewModel.findById(fulfillmentId).lean<CustomerTrackingViewDocument>();
    return doc ? docToCustomerTracking(doc) : null;
  }

  // ── RestaurantFulfillmentView ────────────────────────────────────

  async upsertRestaurantView(view: RestaurantFulfillmentView): Promise<void> {
    await RestaurantFulfillmentViewModel.updateOne(
      { _id: view.fulfillmentId },
      {
        $set: {
          restaurantId: view.restaurantId,
          customerId: view.customerId,
          orderRequestId: view.orderRequestId,
          status: view.status,
          prepEstimateMinutes: view.prepEstimateMinutes,
          lines: view.lines,
          total: view.total,
          createdAt: view.createdAt,
          readyAt: view.readyAt,
          updatedAt: view.updatedAt,
        },
      },
      { upsert: true }
    );
  }

  async removeRestaurantView(fulfillmentId: string): Promise<void> {
    await RestaurantFulfillmentViewModel.deleteOne({ _id: fulfillmentId });
  }

  async findRestaurantQueue(restaurantId: string, status?: string): Promise<RestaurantFulfillmentView[]> {
    const query: Record<string, unknown> = { restaurantId };
    if (status) query.status = status;
    const docs = await RestaurantFulfillmentViewModel.find(query)
      .sort({ createdAt: -1 })
      .lean<RestaurantFulfillmentViewDocument[]>();
    return docs.map(docToRestaurantView);
  }

  // ── RiderQueueView ───────────────────────────────────────────────

  async upsertRiderQueueItem(view: RiderQueueView): Promise<void> {
    await RiderQueueViewModel.updateOne(
      { _id: riderQueueId(view.riderId, view.fulfillmentId) },
      {
        $set: {
          riderId: view.riderId,
          fulfillmentId: view.fulfillmentId,
          assignmentStatus: view.assignmentStatus,
          attempt: view.attempt,
          expiresAt: view.expiresAt,
          restaurantId: view.restaurantId,
          deliveryAddress: view.deliveryAddress,
          total: view.total,
          fulfillmentStatus: view.fulfillmentStatus,
          offeredAt: view.offeredAt,
          updatedAt: view.updatedAt,
        },
      },
      { upsert: true }
    );
  }

  async removeRiderQueueItem(riderId: string, fulfillmentId: string): Promise<void> {
    await RiderQueueViewModel.deleteOne({ _id: riderQueueId(riderId, fulfillmentId) });
  }

  async removeAllRiderQueueItemsForFulfillment(fulfillmentId: string): Promise<void> {
    await RiderQueueViewModel.deleteMany({ fulfillmentId });
  }

  async findRiderQueue(riderId: string): Promise<RiderQueueView[]> {
    const docs = await RiderQueueViewModel.find({ riderId })
      .sort({ offeredAt: -1 })
      .lean<RiderQueueViewDocument[]>();
    return docs.map(docToRiderQueue);
  }

  // ── AdminDashboardView ───────────────────────────────────────────

  async upsertAdminView(view: AdminDashboardView): Promise<void> {
    await AdminDashboardViewModel.updateOne(
      { _id: view.fulfillmentId },
      {
        $set: {
          orderRequestId: view.orderRequestId,
          customerId: view.customerId,
          restaurantId: view.restaurantId,
          status: view.status,
          deliveryStatus: view.deliveryStatus,
          riderId: view.riderId,
          createdAt: view.createdAt,
          updatedAt: view.updatedAt,
          slaBreached: view.slaBreached,
          exceptionFlag: view.exceptionFlag,
          cancellation: view.cancellation,
          failureReason: view.failureReason,
          total: view.total,
        },
      },
      { upsert: true }
    );
  }

  async patchAdminView(
    fulfillmentId: string,
    fields: Partial<Omit<AdminDashboardView, 'fulfillmentId'>>
  ): Promise<void> {
    if (Object.keys(fields).length === 0) return;
    await AdminDashboardViewModel.updateOne({ _id: fulfillmentId }, { $set: fields });
  }

  async findAdminDashboard(query: AdminDashboardQuery): Promise<AdminDashboardView[]> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.slaBreached !== undefined) filter.slaBreached = query.slaBreached;
    if (query.restaurantId) filter.restaurantId = query.restaurantId;

    const docs = await AdminDashboardViewModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(query.offset ?? 0)
      .limit(query.limit ?? 50)
      .lean<AdminDashboardViewDocument[]>();
    return docs.map(docToAdminView);
  }
}
