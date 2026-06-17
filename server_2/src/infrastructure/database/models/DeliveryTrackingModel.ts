// Mongoose model — `delivery_tracking` collection (fulfillment_module.md §8.1, Phase 7).
//
// High-frequency rider GPS samples. NOT the aggregate — writes here never touch `fulfillments`,
// and are throttled (≈1 / window / fulfillment) so volume stays bounded. A TTL index auto-expires
// old samples (24h) so the collection self-prunes. The latest sample also lives in Redis for O(1)
// reads (see RedisLiveLocationStore).
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

// Replay a fulfillment's track newest-first.
DeliveryTrackingSchema.index({ fulfillmentId: 1, recordedAt: -1 });
// Auto-expire stale samples so the write-light collection prunes itself.
DeliveryTrackingSchema.index({ recordedAt: 1 }, { expireAfterSeconds: TRACKING_TTL_SECONDS });

export const DeliveryTrackingModel = model<DeliveryTrackingDocument>(
  'DeliveryTracking',
  DeliveryTrackingSchema
);
