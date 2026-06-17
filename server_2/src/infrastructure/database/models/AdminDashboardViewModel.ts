// Mongoose model — `admin_dashboard_views` collection (fulfillment_module.md §11, Phase 6).
// One document per fulfillment. All events upsert this view. Indexed for admin dashboard queries.
import { Schema, model } from 'mongoose';

export interface AdminDashboardViewDocument {
  _id: string; // fulfillmentId
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

const AdminCancellationSchema = new Schema(
  {
    cancelledBy: { type: String, required: true },
    reason: { type: String, required: true },
    at: { type: Date, required: true },
  },
  { _id: false }
);

const AdminDashboardViewSchema = new Schema<AdminDashboardViewDocument>(
  {
    _id: { type: String, required: true },
    orderRequestId: { type: String, required: true },
    customerId: { type: String, required: true },
    restaurantId: { type: String, required: true },
    status: { type: String, required: true },
    deliveryStatus: { type: String, required: true },
    riderId: { type: String, default: null },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    slaBreached: { type: Boolean, default: false },
    exceptionFlag: { type: Boolean, default: false },
    cancellation: { type: AdminCancellationSchema, default: null },
    failureReason: { type: String, default: null },
    total: {
      type: new Schema({ amount: Number, currency: String }, { _id: false }),
      required: true,
    },
  },
  {
    versionKey: false,
    timestamps: false,
    collection: 'admin_dashboard_views',
  }
);

// Admin dashboard queries (findAdminDashboard): an optional equality filter on ONE of
// status / slaBreached / restaurantId, ALWAYS sorted by createdAt desc and paginated (skip/limit).
// Each index trails `createdAt: -1` so the equality prefix serves the filter and the trailing key
// serves the sort — no blocking in-memory SORT over large, paginated result sets.
// `{ createdAt: -1 }` backs the default (no-filter) dashboard view.
// (Batch 9.2: replaces the earlier `{slaBreached,status}` / `{restaurantId,status}` indexes whose
//  trailing key did not match the createdAt sort, and drops the unused `{exceptionFlag,status}`
//  index — findAdminDashboard never filters on exceptionFlag.)
AdminDashboardViewSchema.index({ status: 1, createdAt: -1 });
AdminDashboardViewSchema.index({ slaBreached: 1, createdAt: -1 });
AdminDashboardViewSchema.index({ restaurantId: 1, createdAt: -1 });
AdminDashboardViewSchema.index({ createdAt: -1 });

export const AdminDashboardViewModel = model<AdminDashboardViewDocument>(
  'AdminDashboardView',
  AdminDashboardViewSchema
);
