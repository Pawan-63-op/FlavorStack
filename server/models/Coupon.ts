import mongoose, { Schema } from 'mongoose';
import { ICoupon } from "@/Types/allTypes";

const couponSchema = new Schema<ICoupon>({
  
  code: {
    type: String,
    required: [true, 'Please add a coupon code'],
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Please add a description']
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed', 'shipping'],
    required: true
  },
  discount: {
    type: Number,
    required: [true, 'Please add a discount value']
  },
  minOrder: {
    type: Number,
    default: 0
  },
  maxDiscount: {
    type: Number
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: [true, 'Please add an expiry date']
  },
  usageLimit: {
    type: Number,
    default: undefined
  },
  usedCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

const Coupon = mongoose.model<ICoupon>('Coupon', couponSchema);

export default Coupon;
