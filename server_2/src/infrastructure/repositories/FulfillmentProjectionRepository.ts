import {
  IFulfillmentProjectionRepository,
  CustomerTrackingView,
  CustomerOrderSummaryView,
  CustomerOrderQuery,
  RestaurantFulfillmentView,
  RiderQueueView,
  RiderDeliveryHistoryView,
  RiderHistoryQuery,
  AdminDashboardView,
  AdminDashboardQuery,
  AnalyticsQuery,
  AnalyticsAggregate,
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
import { FULFILLMENT_STATUS } from '../../domain/fulfillment/enums/fulfillment-status.enum';

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

function docToCustomerOrderSummary(doc: CustomerTrackingViewDocument): CustomerOrderSummaryView {
  const placedAt = doc.timeline.reduce<Date>(
    (earliest, t) => (t.at < earliest ? t.at : earliest),
    doc.timeline[0]?.at ?? doc.updatedAt
  );
  return {
    fulfillmentId: doc._id,
    orderRequestId: doc.orderRequestId,
    restaurantId: doc.restaurantId,
    fulfillmentStatus: doc.currentStatus,
    deliveryStatus: doc.deliveryStatus,
    total: doc.total,
    placedAt,
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

  async upsertCustomerTracking(params: {
    fulfillmentId: string;
    eventId: string;
    set: Partial<Omit<CustomerTrackingView, 'fulfillmentId' | 'timeline'>>;
    timelineEntry: TrackingTimelineEntry;
  }): Promise<void> {
    const { fulfillmentId, eventId, set, timelineEntry } = params;

    await CustomerTrackingViewModel.updateOne(
      { _id: fulfillmentId },
      {
        $set: { ...set, updatedAt: new Date() },
        $addToSet: { processedEventIds: eventId },
      },
      { upsert: true }
    );

    await CustomerTrackingViewModel.updateOne(
      { _id: fulfillmentId, 'timeline.eventId': { $ne: eventId } },
      { $push: { timeline: timelineEntry } }
    );
  }

  async findCustomerTracking(fulfillmentId: string): Promise<CustomerTrackingView | null> {
    const doc = await CustomerTrackingViewModel.findById(fulfillmentId).lean<CustomerTrackingViewDocument>();
    return doc ? docToCustomerTracking(doc) : null;
  }

  async findByCustomer(customerId: string, query?: CustomerOrderQuery): Promise<CustomerOrderSummaryView[]> {
    const docs = await CustomerTrackingViewModel.find({ customerId })
      .sort({ updatedAt: -1 })
      .skip(query?.offset ?? 0)
      .limit(query?.limit ?? 50)
      .lean<CustomerTrackingViewDocument[]>();
    return docs.map(docToCustomerOrderSummary);
  }


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

  async findRiderCompletedDeliveries(
    riderId: string,
    query?: RiderHistoryQuery
  ): Promise<RiderDeliveryHistoryView[]> {
    const docs = await AdminDashboardViewModel.find({
      riderId,
      status: FULFILLMENT_STATUS.DELIVERED,
    })
      .sort({ updatedAt: -1 })
      .skip(query?.offset ?? 0)
      .limit(query?.limit ?? 50)
      .lean<AdminDashboardViewDocument[]>();
    return docs.map((doc) => ({
      fulfillmentId: doc._id,
      restaurantId: doc.restaurantId,
      status: doc.status,
      total: doc.total,
      deliveredAt: doc.updatedAt,
    }));
  }


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

  async aggregateAnalytics(query: AnalyticsQuery): Promise<AnalyticsAggregate> {
    const { restaurantIds, from, to, prevFrom } = query;

    const baseMatch: Record<string, unknown> = { createdAt: { $gte: prevFrom, $lte: to } };
    if (restaurantIds !== undefined) baseMatch.restaurantId = { $in: restaurantIds };

    const inWindow = { createdAt: { $gte: from, $lte: to } };
    const inPrev = { createdAt: { $gte: prevFrom, $lt: from } };
    const deliveredInWindow = { status: FULFILLMENT_STATUS.DELIVERED, ...inWindow };

    const facet = (
      await AdminDashboardViewModel.aggregate([
        { $match: baseMatch },
        {
          $facet: {
            totals: [{ $match: inWindow }, { $count: 'n' }],
            delivered: [
              { $match: deliveredInWindow },
              { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$total.amount' } } },
            ],
            statusBuckets: [{ $match: inWindow }, { $group: { _id: '$status', count: { $sum: 1 } } }],
            revenueByDay: [
              { $match: deliveredInWindow },
              {
                $group: {
                  _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                  amount: { $sum: '$total.amount' },
                },
              },
              { $sort: { _id: 1 } },
            ],
            topRestaurants: [
              { $match: deliveredInWindow },
              { $group: { _id: '$restaurantId', revenue: { $sum: '$total.amount' }, orders: { $sum: 1 } } },
              { $sort: { revenue: -1 } },
              { $limit: 5 },
            ],
            prevTotals: [{ $match: inPrev }, { $count: 'n' }],
            prevDelivered: [
              { $match: { status: FULFILLMENT_STATUS.DELIVERED, ...inPrev } },
              { $group: { _id: null, revenue: { $sum: '$total.amount' } } },
            ],
          },
        },
      ])
    )[0] as AnalyticsFacet | undefined;

    const count = (rows?: Array<{ n: number }>): number => rows?.[0]?.n ?? 0;
    const delivered = facet?.delivered[0];
    const prevDelivered = facet?.prevDelivered[0];

    return {
      totalOrders: count(facet?.totals),
      deliveredCount: delivered?.count ?? 0,
      deliveredRevenue: delivered?.revenue ?? 0,
      statusBreakdown: (facet?.statusBuckets ?? []).map((b) => ({ status: b._id, count: b.count })),
      revenueByDay: (facet?.revenueByDay ?? []).map((d) => ({ date: d._id, amount: d.amount })),
      topRestaurants: (facet?.topRestaurants ?? []).map((r) => ({
        restaurantId: r._id,
        revenue: r.revenue,
        orders: r.orders,
      })),
      prevTotalOrders: count(facet?.prevTotals),
      prevDeliveredRevenue: prevDelivered?.revenue ?? 0,
    };
  }
}

/** Raw `$facet` output shape for aggregateAnalytics. */
interface AnalyticsFacet {
  totals: Array<{ n: number }>;
  delivered: Array<{ count: number; revenue: number }>;
  statusBuckets: Array<{ _id: string; count: number }>;
  revenueByDay: Array<{ _id: string; amount: number }>;
  topRestaurants: Array<{ _id: string; revenue: number; orders: number }>;
  prevTotals: Array<{ n: number }>;
  prevDelivered: Array<{ revenue: number }>;
}
