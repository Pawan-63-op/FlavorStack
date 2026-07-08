import { Schema, model } from 'mongoose';

const TRACKING_TTL_SECONDS = 24 * 60 * 60; // 24h

export interface DeliveryTrackingDocument {
  fulfillmentId: string;
  riderId: string;
  lat: number;
  lng: number;
  recordedAt: Date;
}

const DeliveryTrackingSchema = new Schema<DeliveryTrackingDocument>(
  {
    fulfillmentId: { type: String, required: true },
    riderId: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    recordedAt: { type: Date, required: true },
  },
  {
    versionKey: false,
    timestamps: false,
    collection: 'delivery_tracking',
  }
);

DeliveryTrackingSchema.index({ fulfillmentId: 1, recordedAt: -1 });
DeliveryTrackingSchema.index({ recordedAt: 1 }, { expireAfterSeconds: TRACKING_TTL_SECONDS });

export const DeliveryTrackingModel = model<DeliveryTrackingDocument>(
  'DeliveryTracking',
  DeliveryTrackingSchema
);
