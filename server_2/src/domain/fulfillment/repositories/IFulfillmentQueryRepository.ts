/**
 * Read-only queries against the fulfillment source of truth (`fulfillments`).
 *
 * This exists so reads that a derived projection was only ever *copying* — the rider
 * queue, rider delivery history, the admin dashboard and its analytics — hit the
 * aggregate collection directly instead of a read model that has to be kept in sync.
 * No method here writes, and none participates in a transaction (`TransactionContext`
 * is deliberately absent from every signature).
 *
 * The view shapes below are the ones the existing response mappers already consume, so
 * the API contract is unchanged: the data is read from a different place, not reshaped.
 *
 * @see architecture-simplify/Phase-3_Plan.md — Batch 3 (rider reads), Batch 4 (admin).
 */

export interface FulfillmentAddressView {
  label?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  coordinates: { lat: number; lng: number };
}

/**
 * A rider's live assignment. Derived from `currentAssignment` on the aggregate, which
 * holds the single in-flight attempt: `assignmentStatus` is `OFFERED` until the rider
 * accepts, then `ACCEPTED`. Reject / reassign-away / offer-expiry all null the field on
 * the aggregate, so those rows drop out of the queue without an explicit delete.
 */
export interface RiderQueueView {
  riderId: string;
  fulfillmentId: string;
  assignmentStatus: string;
  attempt: number;
  expiresAt: Date | null;
  restaurantId: string;
  deliveryAddress: FulfillmentAddressView;
  total: { amount: number; currency: string };
  fulfillmentStatus: string;
  offeredAt: Date;
  updatedAt: Date;
}

/**
 * Rider completed-delivery history row (Phase 15 / G19), backing the driver UI's past
 * deliveries + earnings. `completeDelivery` does not clear `currentAssignment`, so the
 * accepted rider is still recorded on a DELIVERED fulfillment.
 */
export interface RiderDeliveryHistoryView {
  fulfillmentId: string;
  restaurantId: string;
  status: string;
  total: { amount: number; currency: string };
  /** The aggregate's real delivery timestamp (falls back to `updatedAt` on legacy rows). */
  deliveredAt: Date;
}

export interface RiderHistoryQuery {
  limit?: number;
  offset?: number;
}

/**
 * An operations row on the admin Fulfillments tab.
 *
 * Two fields are derived rather than stored:
 * - `riderId` is populated **only** for an `ACCEPTED` assignment. A merely `OFFERED` one
 *   maps to `null` — no rider is committed yet.
 * - `exceptionFlag` is `fulfillmentStatus ∈ {CANCELLED, FAILED}`.
 */
export interface AdminDashboardView {
  fulfillmentId: string;
  orderRequestId: string;
  customerId: string;
  restaurantId: string;
  status: string;
  deliveryStatus: string;
  riderId: string | null;
  createdAt: Date;
  updatedAt: Date;
  /**
   * Not implemented. Always `false`, and a `slaBreached: true` filter returns nothing —
   * the retired projection offered the field as a filter but never once set it true.
   * Remove or implement when the API contract opens up.
   */
  slaBreached: boolean;
  exceptionFlag: boolean;
  cancellation: { cancelledBy: string; reason: string; at: Date } | null;
  failureReason: string | null;
  total: { amount: number; currency: string };
}

export interface AdminDashboardQuery {
  status?: string;
  slaBreached?: boolean;
  restaurantId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Owner/Admin Overview analytics (Phase 15 / G13). A time-window aggregation over the
 * fulfillment aggregate. Revenue counts DELIVERED fulfillments only; amounts are minor
 * units (matching the stored `pricingTotal.amount`).
 */
export interface AnalyticsQuery {
  /** Restaurants to scope to. `undefined` = platform-wide (all). `[]` = none (all-zero result). */
  restaurantIds?: string[];
  /** Current window, inclusive on both ends. */
  from: Date;
  to: Date;
  /** Previous window start (inclusive); the previous window ends at `from` (exclusive). */
  prevFrom: Date;
}

export interface AnalyticsStatusBucket {
  status: string;
  count: number;
}

export interface AnalyticsDayRevenue {
  /** `YYYY-MM-DD` (UTC). */
  date: string;
  amount: number;
}

export interface AnalyticsTopRestaurant {
  restaurantId: string;
  revenue: number;
  orders: number;
}

export interface AnalyticsAggregate {
  totalOrders: number;
  deliveredCount: number;
  deliveredRevenue: number;
  statusBreakdown: AnalyticsStatusBucket[];
  revenueByDay: AnalyticsDayRevenue[];
  topRestaurants: AnalyticsTopRestaurant[];
  prevTotalOrders: number;
  prevDeliveredRevenue: number;
}

/**
 * The three fields another context needs to decide whether a fulfillment can be reviewed:
 * who ordered it, from where, and whether it actually arrived.
 *
 * `deliveredAt` is non-null **iff** the fulfillment reached `DELIVERED`, so a caller can
 * treat it as the eligibility gate on its own. Legacy rows written before the aggregate
 * stored `deliveredAt` fall back to `updatedAt`, matching `findRiderCompletedDeliveries`.
 */
export interface ReviewSubjectView {
  fulfillmentId: string;
  customerId: string;
  restaurantId: string;
  deliveredAt: Date | null;
}

export interface IFulfillmentQueryRepository {
  /**
   * The rider's active assignments — offered or accepted, excluding terminal
   * fulfillments — newest offer first.
   */
  findRiderQueue(riderId: string): Promise<RiderQueueView[]>;

  /**
   * One fulfillment reduced to its review-relevant fields, or `null` if no such
   * fulfillment exists. Backs Engagement's `IFulfillmentGateway`, which replaced the
   * `review_eligibility` replica of exactly these fields.
   */
  findReviewSubject(fulfillmentId: string): Promise<ReviewSubjectView | null>;

  /** The rider's DELIVERED fulfillments, newest delivery first. */
  findRiderCompletedDeliveries(
    riderId: string,
    query?: RiderHistoryQuery
  ): Promise<RiderDeliveryHistoryView[]>;

  /** Admin operations dashboard, newest first. */
  findAdminDashboard(query: AdminDashboardQuery): Promise<AdminDashboardView[]>;

  /** Time-window analytics aggregate (G13). */
  aggregateAnalytics(query: AnalyticsQuery): Promise<AnalyticsAggregate>;
}
