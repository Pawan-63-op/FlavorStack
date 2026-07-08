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

AdminDashboardViewSchema.index({ status: 1, createdAt: -1 });
AdminDashboardViewSchema.index({ slaBreached: 1, createdAt: -1 });
AdminDashboardViewSchema.index({ restaurantId: 1, createdAt: -1 });
AdminDashboardViewSchema.index({ createdAt: -1 });
AdminDashboardViewSchema.index({ riderId: 1, status: 1, updatedAt: -1 });

export const AdminDashboardViewModel = model<AdminDashboardViewDocument>(
  'AdminDashboardView',
  AdminDashboardViewSchema
);
