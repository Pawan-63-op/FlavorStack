
export interface TrackingTimelineEntry {
  eventId: string;
  status: string;
  at: Date;
  note?: string;
}

export interface TrackingAddressView {
  label?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  coordinates: { lat: number; lng: number };
}

export interface CustomerTrackingView {
  fulfillmentId: string;
  orderRequestId: string;
  customerId: string;
  restaurantId: string;
  currentStatus: string;
  deliveryStatus: string;
  riderId: string | null;
  timeline: TrackingTimelineEntry[];
  deliveryAddress: TrackingAddressView;
  total: { amount: number; currency: string };
  cancellation: { cancelledBy: string; reason: string; at: Date } | null;
  failureReason: string | null;
  updatedAt: Date;
}

export interface RestaurantFulfillmentView {
  fulfillmentId: string;
  restaurantId: string;
  customerId: string;
  orderRequestId: string;
  status: string;
  prepEstimateMinutes: number | null;
  lines: Array<{ menuItemId: string; name: string; quantity: number; lineTotal: { amount: number; currency: string } }>;
  total: { amount: number; currency: string };
  createdAt: Date;
  readyAt: Date | null;
  updatedAt: Date;
}

export interface RiderQueueView {
  riderId: string;
  fulfillmentId: string;
  assignmentStatus: string;
  attempt: number;
  expiresAt: Date | null;
  restaurantId: string;
  deliveryAddress: TrackingAddressView;
  total: { amount: number; currency: string };
  fulfillmentStatus: string;
  offeredAt: Date;
  updatedAt: Date;
}

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
 * Owner/Admin Overview analytics (Phase 15 / G13). A time-window aggregation over
 * the admin_dashboard_views projection. Revenue counts DELIVERED fulfillments only;
 * amounts are minor units (matching the stored `total.amount`).
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
 * Customer order-history row (Phase 15 / G1). A lean projection over the
 * CustomerTrackingView used to resolve a customer's orders → fulfillments so the
 * frontend can track them (closes the order↔fulfillment linkage gap). `placedAt`
 * is the earliest tracking timeline entry; `fulfillmentStatus` mirrors the view's
 * `currentStatus`.
 */
export interface CustomerOrderSummaryView {
  fulfillmentId: string;
  orderRequestId: string;
  restaurantId: string;
  fulfillmentStatus: string;
  deliveryStatus: string;
  total: { amount: number; currency: string };
  placedAt: Date;
  updatedAt: Date;
}

export interface CustomerOrderQuery {
  limit?: number;
  offset?: number;
}

/**
 * Rider completed-delivery history row (Phase 15 / G19). A lean projection over
 * the admin_dashboard_views, filtered to a rider's DELIVERED fulfillments so the
 * driver UI can show past deliveries + earnings (the rider_queue_views drop
 * terminal items, so history is read from the retained admin view). `deliveredAt`
 * mirrors the view's `updatedAt` at the DELIVERED transition.
 */
export interface RiderDeliveryHistoryView {
  fulfillmentId: string;
  restaurantId: string;
  status: string;
  total: { amount: number; currency: string };
  deliveredAt: Date;
}

export interface RiderHistoryQuery {
  limit?: number;
  offset?: number;
}

export interface IFulfillmentProjectionRepository {
  /** Idempotent: creates or updates the tracking view. Appends timelineEntry only if eventId is new. */
  upsertCustomerTracking(params: {
    fulfillmentId: string;
    eventId: string;
    set: Partial<Omit<CustomerTrackingView, 'fulfillmentId' | 'timeline'>>;
    timelineEntry: TrackingTimelineEntry;
  }): Promise<void>;

  findCustomerTracking(fulfillmentId: string): Promise<CustomerTrackingView | null>;

  /** Customer order history (G1): tracking views for a customer, newest-updated first. */
  findByCustomer(customerId: string, query?: CustomerOrderQuery): Promise<CustomerOrderSummaryView[]>;

  upsertRestaurantView(view: RestaurantFulfillmentView): Promise<void>;
  removeRestaurantView(fulfillmentId: string): Promise<void>;
  findRestaurantQueue(restaurantId: string, status?: string): Promise<RestaurantFulfillmentView[]>;

  upsertRiderQueueItem(view: RiderQueueView): Promise<void>;
  removeRiderQueueItem(riderId: string, fulfillmentId: string): Promise<void>;
  removeAllRiderQueueItemsForFulfillment(fulfillmentId: string): Promise<void>;
  findRiderQueue(riderId: string): Promise<RiderQueueView[]>;
  /** Rider delivery history (G19): the rider's DELIVERED fulfillments, newest first. */
  findRiderCompletedDeliveries(
    riderId: string,
    query?: RiderHistoryQuery
  ): Promise<RiderDeliveryHistoryView[]>;

  upsertAdminView(view: AdminDashboardView): Promise<void>;
  /** Patch only the supplied fields — does not overwrite other fields. */
  patchAdminView(fulfillmentId: string, fields: Partial<Omit<AdminDashboardView, 'fulfillmentId'>>): Promise<void>;
  findAdminDashboard(query: AdminDashboardQuery): Promise<AdminDashboardView[]>;
  /** Time-window analytics aggregate over admin_dashboard_views (G13). */
  aggregateAnalytics(query: AnalyticsQuery): Promise<AnalyticsAggregate>;
}
