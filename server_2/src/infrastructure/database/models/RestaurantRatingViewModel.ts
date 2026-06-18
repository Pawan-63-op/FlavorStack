// Mongoose schema — `restaurant_rating_views` read-model collection (engagement_module.md §7).
// Key: unique restaurantId. Updated incrementally by RecomputeRestaurantRating on approve.
import { Schema, model } from 'mongoose';

export interface RestaurantRatingDistributionDocument {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface RestaurantRatingViewDocument {
  _id: string;
  avgRating: number;
  reviewCount: number;
  distribution: RestaurantRatingDistributionDocument;
  updatedAt: Date;
}

const RestaurantRatingDistributionSchema = new Schema<RestaurantRatingDistributionDocument>(
  {
    1: { type: Number, required: true, default: 0 },
    2: { type: Number, required: true, default: 0 },
    3: { type: Number, required: true, default: 0 },
    4: { type: Number, required: true, default: 0 },
    5: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const RestaurantRatingViewSchema = new Schema<RestaurantRatingViewDocument>(
  {
    _id: { type: String, required: true },
    avgRating: { type: Number, required: true },
    reviewCount: { type: Number, required: true },
    distribution: { type: RestaurantRatingDistributionSchema, required: true },
    updatedAt: { type: Date, required: true },
  },
  {
    versionKey: false,
    timestamps: false,
    collection: 'restaurant_rating_views',
  }
);

export const RestaurantRatingViewModel = model<RestaurantRatingViewDocument>(
  'RestaurantRatingView',
  RestaurantRatingViewSchema
);
