import mongoose, { Schema } from 'mongoose';
import { IReview } from '@/Types/allTypes';

const reviewSchema = new Schema<IReview>({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
 order: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Order",
  required: true
},
  orderId : {
  type: String,
  required: true
},

  rating: {
    type: Number,
    required: [true, 'Please add a rating'],
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: [true, 'Please add a comment']
  },
  photos: [{
    type: String
  }],
  isApproved: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

reviewSchema.index({ user: 1, order: 1 }, { unique: true });

const Review = mongoose.model<IReview>('Review', reviewSchema);

export default Review;
