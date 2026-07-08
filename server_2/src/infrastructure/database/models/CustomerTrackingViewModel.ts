import { Schema, model } from 'mongoose';

export interface TrackingTimelineEntryDocument {
  eventId: string;
  status: string;
  at: Date;
  note?: string;
}

export interface CustomerTrackingViewDocument {
  _id: string; // fulfillmentId
  orderRequestId: string;
  customerId: string;
  restaurantId: string;
  currentStatus: string;
  deliveryStatus: string;
  riderId: string | null;
  timeline: TrackingTimelineEntryDocument[];
  processedEventIds: string[];
  deliveryAddress: {
    label?: string;
    street: string;
    city: string;
    state: string;
    pinCode: string;
    coordinates: { lat: number; lng: number };
  };
  total: { amount: number; currency: string };
  cancellation: { cancelledBy: string; reason: string; at: Date } | null;
  failureReason: string | null;
  updatedAt: Date;
}

const TimelineEntrySchema = new Schema<TrackingTimelineEntryDocument>(
  {
    eventId: { type: String, required: true },
    status: { type: String, required: true },
    at: { type: Date, required: true },
    note: { type: String, required: false },
  },
  { _id: false }
);

const TrackingAddressSchema = new Schema(
  {
    label: { type: String, required: false },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pinCode: { type: String, required: true },
    coordinates: {
      type: new Schema({ lat: Number, lng: Number }, { _id: false }),
      required: true,
    },
  },
  { _id: false }
);

const CancellationSchema = new Schema(
  {
    cancelledBy: { type: String, required: true },
    reason: { type: String, required: true },
    at: { type: Date, required: true },
  },
  { _id: false }
);

const CustomerTrackingViewSchema = new Schema<CustomerTrackingViewDocument>(
  {
    _id: { type: String, required: true },
    orderRequestId: { type: String, required: true },
    customerId: { type: String, required: true },
    restaurantId: { type: String, required: true },
    currentStatus: { type: String, required: true },
    deliveryStatus: { type: String, required: true },
    riderId: { type: String, default: null },
    timeline: { type: [TimelineEntrySchema], default: [] },
    processedEventIds: { type: [String], default: [] },
    deliveryAddress: { type: TrackingAddressSchema, required: true },
    total: {
      type: new Schema({ amount: Number, currency: String }, { _id: false }),
      required: true,
    },
    cancellation: { type: CancellationSchema, default: null },
    failureReason: { type: String, default: null },
    updatedAt: { type: Date, required: true },
  },
  {
    versionKey: false,
    timestamps: false,
    collection: 'customer_tracking_views',
  }
);

CustomerTrackingViewSchema.index({ customerId: 1, updatedAt: -1 });

export const CustomerTrackingViewModel = model<CustomerTrackingViewDocument>(
  'CustomerTrackingView',
  CustomerTrackingViewSchema
);
