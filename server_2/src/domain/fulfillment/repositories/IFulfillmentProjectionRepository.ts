// Port for the fulfillment read-model projections (fulfillment_module.md §11, Phase 6).
// All write methods are idempotent (upsert-safe). Implemented by MongoFulfillmentProjectionRepository.

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

export interface IFulfillmentProjectionRepository {
  // ── CustomerTrackingView ─────────────────────────────────────────
  /** Idempotent: creates or updates the tracking view. Appends timelineEntry only if eventId is new. */
  upsertCustomerTracking(params: {
    fulfillmentId: string;
    eventId: string;
    set: Partial<Omit<CustomerTrackingView, 'fulfillmentId' | 'timeline'>>;
    timelineEntry: TrackingTimelineEntry;
  }): Promise<void>;

  findCustomerTracking(fulfillmentId: string): Promise<CustomerTrackingView | null>;

  // ── RestaurantFulfillmentView ────────────────────────────────────
  upsertRestaurantView(view: RestaurantFulfillmentView): Promise<void>;
  removeRestaurantView(fulfillmentId: string): Promise<void>;
  findRestaurantQueue(restaurantId: string, status?: string): Promise<RestaurantFulfillmentView[]>;

  // ── RiderQueueView ───────────────────────────────────────────────
  upsertRiderQueueItem(view: RiderQueueView): Promise<void>;
  removeRiderQueueItem(riderId: string, fulfillmentId: string): Promise<void>;
  removeAllRiderQueueItemsForFulfillment(fulfillmentId: string): Promise<void>;
  findRiderQueue(riderId: string): Promise<RiderQueueView[]>;

  // ── AdminDashboardView ───────────────────────────────────────────
  upsertAdminView(view: AdminDashboardView): Promise<void>;
  /** Patch only the supplied fields — does not overwrite other fields. */
  patchAdminView(fulfillmentId: string, fields: Partial<Omit<AdminDashboardView, 'fulfillmentId'>>): Promise<void>;
  findAdminDashboard(query: AdminDashboardQuery): Promise<AdminDashboardView[]>;
}
