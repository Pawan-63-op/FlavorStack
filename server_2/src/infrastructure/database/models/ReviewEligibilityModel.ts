import { Schema, model } from 'mongoose';

export interface ReviewEligibilityDocument {
  _id: string;
  customerId: string;
  restaurantId: string;
  deliveredAt: Date | null;
  reviewed: boolean;
}

const ReviewEligibilitySchema = new Schema<ReviewEligibilityDocument>(
  {
    _id: { type: String, required: true },
    customerId: { type: String, required: true },
    restaurantId: { type: String, required: true },
    deliveredAt: { type: Date, required: false, default: null },
    reviewed: { type: Boolean, required: true, default: false },
  },
  {
    versionKey: false,
    timestamps: false,
    collection: 'review_eligibility',
  }
);

export const ReviewEligibilityModel = model<ReviewEligibilityDocument>(
  'ReviewEligibility',
  ReviewEligibilitySchema
);
