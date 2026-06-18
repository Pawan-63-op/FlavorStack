// Mongoose schema — `reviews` collection (engagement_module.md §6).
// Indexes: unique customerId+fulfillmentId (one review per delivered order);
// restaurantId+moderationStatus+createdAt (public/admin listing).
import { Schema, model } from 'mongoose';

export interface ReviewDocument {
  _id: string;
  customerId: string;
  restaurantId: string;
  fulfillmentId: string;
  restaurantRating: number;
  deliveryRating: number | null;
  comment: string | null;
  moderationStatus: string;
  createdAt: Date;
  moderatedAt?: Date;
  moderatedBy?: string;
}

const ReviewSchema = new Schema<ReviewDocument>(
  {
    _id: { type: String, required: true },
    customerId: { type: String, required: true },
    restaurantId: { type: String, required: true },
    fulfillmentId: { type: String, required: true },
    restaurantRating: { type: Number, required: true },
    deliveryRating: { type: Number, required: false, default: null },
    comment: { type: String, required: false, default: null },
    moderationStatus: { type: String, required: true },
    createdAt: { type: Date, required: true },
    moderatedAt: { type: Date, required: false },
    moderatedBy: { type: String, required: false },
  },
  {
    versionKey: false,
    timestamps: false,
    collection: 'reviews',
  }
);

ReviewSchema.index({ customerId: 1, fulfillmentId: 1 }, { unique: true });
ReviewSchema.index({ restaurantId: 1, moderationStatus: 1, createdAt: -1 });

export const ReviewModel = model<ReviewDocument>('Review', ReviewSchema);
