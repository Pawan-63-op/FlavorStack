
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
 * The one fulfillment projection left after Phase 3: `customer_tracking_views`.
 *
 * It survives because `timeline[]` is append-only derived data the aggregate does not store.
 * Everything the retired rider/admin/restaurant views held was already on `fulfillments`, and is
 * now read from there through `IFulfillmentQueryRepository`.
 */
export interface ICustomerTrackingRepository {
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
}
