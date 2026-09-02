import {
  IFulfillmentQueryRepository,
  FulfillmentAddressView,
  RiderQueueView,
  RiderDeliveryHistoryView,
  RiderHistoryQuery,
  AdminDashboardView,
  AdminDashboardQuery,
  AnalyticsQuery,
  AnalyticsAggregate,
  ReviewSubjectView,
} from '../../domain/fulfillment/repositories/IFulfillmentQueryRepository';
import { FulfillmentModel, FulfillmentDocument } from '../database/models/FulfillmentModel';
import { FULFILLMENT_STATUS } from '../../domain/fulfillment/enums/fulfillment-status.enum';
import { RIDER_ASSIGNMENT_STATUS } from '../../domain/fulfillment/enums/rider-assignment-status.enum';

/**
 * Fulfillment statuses at which the delivery is over. `completeDelivery` leaves
 * `currentAssignment` in `ACCEPTED`, so without this exclusion a delivered order would
 * linger in the rider's active queue forever.
 */
const TERMINAL_STATUSES = [
  FULFILLMENT_STATUS.DELIVERED,
  FULFILLMENT_STATUS.CANCELLED,
  FULFILLMENT_STATUS.FAILED,
];

/** Statuses that raise the admin dashboard's `exceptionFlag`. */
const EXCEPTION_STATUSES: string[] = [FULFILLMENT_STATUS.CANCELLED, FULFILLMENT_STATUS.FAILED];

const DEFAULT_LIMIT = 50;

export class MongoFulfillmentQueryRepository implements IFulfillmentQueryRepository {
  async findRiderQueue(riderId: string): Promise<RiderQueueView[]> {
    const docs = await FulfillmentModel.find({
      'currentAssignment.riderId': riderId,
      'currentAssignment.status': {
        $in: [RIDER_ASSIGNMENT_STATUS.OFFERED, RIDER_ASSIGNMENT_STATUS.ACCEPTED],
      },
      fulfillmentStatus: { $nin: TERMINAL_STATUSES },
    })
      .sort({ 'currentAssignment.offeredAt': -1 })
      .lean<FulfillmentDocument[]>();

    return docs.map((doc) => this.toRiderQueueView(doc));
  }

  async findReviewSubject(fulfillmentId: string): Promise<ReviewSubjectView | null> {
    const doc = await FulfillmentModel.findOne({ _id: fulfillmentId })
      .select({ customerId: 1, restaurantId: 1, fulfillmentStatus: 1, deliveredAt: 1, updatedAt: 1 })
      .lean<FulfillmentDocument>();
    if (!doc) return null;

    const delivered = doc.fulfillmentStatus === FULFILLMENT_STATUS.DELIVERED;
    return {
      fulfillmentId: doc._id,
      customerId: doc.customerId,
      restaurantId: doc.restaurantId,
      // Non-null iff DELIVERED — the caller's whole eligibility gate. Legacy rows predate
      // the aggregate storing `deliveredAt`, hence the `updatedAt` fallback.
      deliveredAt: delivered ? (doc.deliveredAt ?? doc.updatedAt) : null,
    };
  }

  async findRiderCompletedDeliveries(
    riderId: string,
    query?: RiderHistoryQuery
  ): Promise<RiderDeliveryHistoryView[]> {
    const docs = await FulfillmentModel.find({
      'currentAssignment.riderId': riderId,
      fulfillmentStatus: FULFILLMENT_STATUS.DELIVERED,
    })
      .sort({ deliveredAt: -1 })
      .skip(query?.offset ?? 0)
      .limit(query?.limit ?? DEFAULT_LIMIT)
      .lean<FulfillmentDocument[]>();

    return docs.map((doc) => this.toRiderDeliveryHistoryView(doc));
  }

  async findAdminDashboard(query: AdminDashboardQuery): Promise<AdminDashboardView[]> {
    // `slaBreached` was never once set true by the retired projection, so a `true` filter
    // could only ever match nothing. Short-circuit rather than issue a query that is
    // guaranteed to return no rows — and see the field note on `AdminDashboardView`.
    if (query.slaBreached === true) return [];

    const filter: Record<string, unknown> = {};
    if (query.status) filter.fulfillmentStatus = query.status;
    if (query.restaurantId) filter.restaurantId = query.restaurantId;

    const docs = await FulfillmentModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(query.offset ?? 0)
      .limit(query.limit ?? DEFAULT_LIMIT)
      .lean<FulfillmentDocument[]>();

    return docs.map((doc) => this.toAdminDashboardView(doc));
  }

  async aggregateAnalytics(query: AnalyticsQuery): Promise<AnalyticsAggregate> {
    const { restaurantIds, from, to, prevFrom } = query;

    const baseMatch: Record<string, unknown> = { createdAt: { $gte: prevFrom, $lte: to } };
    if (restaurantIds !== undefined) baseMatch.restaurantId = { $in: restaurantIds };

    const inWindow = { createdAt: { $gte: from, $lte: to } };
    const inPrev = { createdAt: { $gte: prevFrom, $lt: from } };
    const deliveredInWindow = { fulfillmentStatus: FULFILLMENT_STATUS.DELIVERED, ...inWindow };

    const facet = (
      await FulfillmentModel.aggregate([
        { $match: baseMatch },
        {
          $facet: {
            totals: [{ $match: inWindow }, { $count: 'n' }],
            delivered: [
              { $match: deliveredInWindow },
              { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$pricingTotal.amount' } } },
            ],
            statusBuckets: [
              { $match: inWindow },
              { $group: { _id: '$fulfillmentStatus', count: { $sum: 1 } } },
            ],
            revenueByDay: [
              { $match: deliveredInWindow },
              {
                $group: {
                  _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                  amount: { $sum: '$pricingTotal.amount' },
                },
              },
              { $sort: { _id: 1 } },
            ],
            topRestaurants: [
              { $match: deliveredInWindow },
              {
                $group: {
                  _id: '$restaurantId',
                  revenue: { $sum: '$pricingTotal.amount' },
                  orders: { $sum: 1 },
                },
              },
              { $sort: { revenue: -1 } },
              { $limit: 5 },
            ],
            prevTotals: [{ $match: inPrev }, { $count: 'n' }],
            prevDelivered: [
              { $match: { fulfillmentStatus: FULFILLMENT_STATUS.DELIVERED, ...inPrev } },
              { $group: { _id: null, revenue: { $sum: '$pricingTotal.amount' } } },
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

  private toAdminDashboardView(doc: FulfillmentDocument): AdminDashboardView {
    const assignment = doc.currentAssignment;
    return {
      fulfillmentId: doc._id,
      orderRequestId: doc.orderRequestId,
      customerId: doc.customerId,
      restaurantId: doc.restaurantId,
      status: doc.fulfillmentStatus,
      deliveryStatus: doc.deliveryStatus,
      // An OFFERED-only assignment has no committed rider yet.
      riderId:
        assignment?.status === RIDER_ASSIGNMENT_STATUS.ACCEPTED ? assignment.riderId : null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      slaBreached: false,
      exceptionFlag: EXCEPTION_STATUSES.includes(doc.fulfillmentStatus),
      cancellation: doc.cancellation ?? null,
      failureReason: doc.failureReason ?? null,
      total: doc.pricingTotal,
    };
  }

  private toRiderQueueView(doc: FulfillmentDocument): RiderQueueView {
    // Only reached for docs the query already filtered on `currentAssignment.*`.
    const assignment = doc.currentAssignment!;
    return {
      riderId: assignment.riderId,
      fulfillmentId: doc._id,
      assignmentStatus: assignment.status,
      attempt: assignment.attempt,
      expiresAt: assignment.expiresAt ?? null,
      restaurantId: doc.restaurantId,
      deliveryAddress: doc.deliveryAddress as FulfillmentAddressView,
      total: doc.pricingTotal,
      fulfillmentStatus: doc.fulfillmentStatus,
      offeredAt: assignment.offeredAt,
      updatedAt: doc.updatedAt,
    };
  }

  private toRiderDeliveryHistoryView(doc: FulfillmentDocument): RiderDeliveryHistoryView {
    return {
      fulfillmentId: doc._id,
      restaurantId: doc.restaurantId,
      status: doc.fulfillmentStatus,
      // The retired admin view mislabelled its own `updatedAt` as `deliveredAt`; the
      // aggregate records the real one. `updatedAt` remains the fallback for rows
      // written before `deliveredAt` was persisted.
      deliveredAt: doc.deliveredAt ?? doc.updatedAt,
      total: doc.pricingTotal,
    };
  }
}

/** Raw `$facet` output shape for `aggregateAnalytics`. */
interface AnalyticsFacet {
  totals: Array<{ n: number }>;
  delivered: Array<{ count: number; revenue: number }>;
  statusBuckets: Array<{ _id: string; count: number }>;
  revenueByDay: Array<{ _id: string; amount: number }>;
  topRestaurants: Array<{ _id: string; revenue: number; orders: number }>;
  prevTotals: Array<{ n: number }>;
  prevDelivered: Array<{ revenue: number }>;
}
