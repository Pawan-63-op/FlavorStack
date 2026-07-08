import { Schema, model } from 'mongoose';

export interface RiderQueueViewDocument {
  _id: string; // `${riderId}:${fulfillmentId}`
  riderId: string;
  fulfillmentId: string;
  assignmentStatus: string; // OFFERED | ACCEPTED | ...
  attempt: number;
  expiresAt: Date | null;
  restaurantId: string;
  deliveryAddress: {
    label?: string;
    street: string;
    city: string;
    state: string;
    pinCode: string;
    coordinates: { lat: number; lng: number };
  };
  total: { amount: number; currency: string };
  fulfillmentStatus: string;
  offeredAt: Date;
  updatedAt: Date;
}

const RiderAddressSchema = new Schema(
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

const RiderQueueViewSchema = new Schema<RiderQueueViewDocument>(
  {
    _id: { type: String, required: true },
    riderId: { type: String, required: true },
    fulfillmentId: { type: String, required: true },
    assignmentStatus: { type: String, required: true },
    attempt: { type: Number, required: true },
    expiresAt: { type: Date, default: null },
    restaurantId: { type: String, required: true },
    deliveryAddress: { type: RiderAddressSchema, required: true },
    total: {
      type: new Schema({ amount: Number, currency: String }, { _id: false }),
      required: true,
    },
    fulfillmentStatus: { type: String, required: true },
    offeredAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  {
    versionKey: false,
    timestamps: false,
    collection: 'rider_queue_views',
  }
);

RiderQueueViewSchema.index({ riderId: 1, offeredAt: -1 });
RiderQueueViewSchema.index({ fulfillmentId: 1 });

export const RiderQueueViewModel = model<RiderQueueViewDocument>(
  'RiderQueueView',
  RiderQueueViewSchema
);
