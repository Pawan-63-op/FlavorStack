import mongoose, { Schema } from 'mongoose';
// import { IOrder } from '../types/index';
import {IOrder} from "@/Types/allTypes";

const orderSchema = new Schema<IOrder>({
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  restaurant: {
    type: Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  restaurantName: {
    type: String,
    required: true
  },
  items: [{
    menuItem: {
      type: Schema.Types.ObjectId,
      ref: 'MenuItem'
    },
    name: String,
    price: Number,
    quantity: {
      type: Number,
      required: true,
      min: 1
    }
  }],
  subtotal: {
    type: Number,
    required: true
  },
  deliveryFee: {
    type: Number,
    default: 2.99
  },
  tax: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true
  },
  couponApplied: {
    code: String,
    discount: Number
  },
  deliveryAddress: {
    name: String,
    phone: String,
    address: String
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'cash', 'wallet'],
    default: 'card'
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'out-for-delivery', 'Delivered', 'cancelled'],
    default: 'pending'
  },
  pointsEarned: {
    type: Number,
    default: 0
  },
  hasReview: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Generate order ID
orderSchema.pre('save', function(next) {
  if (!this.orderId) {
    this.orderId = 'ORD-' + Date.now().toString(36).toUpperCase();
  }
  next();
});

const Order = mongoose.model<IOrder>('Order', orderSchema);

export default Order;
