// Mongoose model — `restaurant_fulfillment_views` collection (fulfillment_module.md §11, Phase 6).
// One document per active fulfillment keyed by fulfillmentId; rows are removed on terminal events.
import { Schema, model } from 'mongoose';

export interface RestaurantFulfillmentViewLineDocument {
  menuItemId: string;
  name: string;
  quantity: number;
  lineTotal: { amount: number; currency: string };
}

export interface RestaurantFulfillmentViewDocument {
  _id: string; // fulfillmentId
  restaurantId: string;
  customerId: string;
  orderRequestId: string;
  status: string;
  prepEstimateMinutes: number | null;
  lines: RestaurantFulfillmentViewLineDocument[];
  total: { amount: number; currency: string };
  createdAt: Date;
  readyAt: Date | null;
  updatedAt: Date;
}

const LineSchema = new Schema<RestaurantFulfillmentViewLineDocument>(
  {
    menuItemId: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    lineTotal: {
      type: new Schema({ amount: Number, currency: String }, { _id: false }),
      required: true,
    },
  },
  { _id: false }
);

const RestaurantFulfillmentViewSchema = new Schema<RestaurantFulfillmentViewDocument>(
  {
    _id: { type: String, required: true },
    restaurantId: { type: String, required: true },
    customerId: { type: String, required: true },
    orderRequestId: { type: String, required: true },
    status: { type: String, required: true },
    prepEstimateMinutes: { type: Number, default: null },
    lines: { type: [LineSchema], default: [] },
    total: {
      type: new Schema({ amount: Number, currency: String }, { _id: false }),
      required: true,
    },
    createdAt: { type: Date, required: true },
    readyAt: { type: Date, default: null },
    updatedAt: { type: Date, required: true },
  },
  {
    versionKey: false,
    timestamps: false,
    collection: 'restaurant_fulfillment_views',
  }
);

// Restaurant queue board: active fulfillments for a restaurant ordered by creation.
RestaurantFulfillmentViewSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });

export const RestaurantFulfillmentViewModel = model<RestaurantFulfillmentViewDocument>(
  'RestaurantFulfillmentView',
  RestaurantFulfillmentViewSchema
);
