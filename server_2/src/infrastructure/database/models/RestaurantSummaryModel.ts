import { Schema, model } from 'mongoose';
import { GeoJsonPoint, OpeningHoursDocument } from './RestaurantModel';

export interface RestaurantSummaryDocument {
  _id: string;
  name: string;
  slug: string;
  cuisineTypes: string[];
  status: string;
  visibility: string;
  location: GeoJsonPoint;
  imageUrl: string | null;
  openingHours: OpeningHoursDocument | null;
  tzOffsetMinutes: number;
  deletedAt: Date | null;
}

const RestaurantSummarySchema = new Schema<RestaurantSummaryDocument>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    cuisineTypes: { type: [String], default: [] },
    status: { type: String, required: true },
    visibility: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    imageUrl: { type: String, default: null },
    openingHours: {
      type: new Schema(
        {
          schedule: { type: Schema.Types.Mixed, required: true },
          holidays: { type: [String], default: [] },
        },
        { _id: false }
      ),
      default: null,
    },
    tzOffsetMinutes: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { versionKey: false, collection: 'restaurant_summary' }
);

RestaurantSummarySchema.index({ slug: 1 });
RestaurantSummarySchema.index({ status: 1, visibility: 1 });
RestaurantSummarySchema.index({ cuisineTypes: 1 });
RestaurantSummarySchema.index({ deletedAt: 1 }, { sparse: true });
RestaurantSummarySchema.index({ location: '2dsphere' });
RestaurantSummarySchema.index(
  { name: 'text', cuisineTypes: 'text' },
  { weights: { name: 5, cuisineTypes: 1 }, name: 'restaurant_search_text' }
);

export const RestaurantSummaryModel = model<RestaurantSummaryDocument>(
  'RestaurantSummary',
  RestaurantSummarySchema
);
