import mongoose, { Schema } from 'mongoose';
import { IRestaurant } from '@/Types/allTypes'
const restaurantSchema = new Schema<IRestaurant>({
  restaurantName: {
    type: String,
    required: [true, 'Please add a restaurant name'],
    trim: true
  },
  cuisine: {
    type: String,
    required: [true, 'Please add a cuisine type']
  },
  description: {
    type: String,
    default: ''
  },
  imageUrl: {
    type: String,
    default: 'https://images.unsplash.com/photo-1559339352-11d035aa65de'
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  deliveryTime: {
    type: String,
    default: '30-40 min'
  },
  city: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true
  },
  priceRange: {
    type: String,
    enum: ['$', '$$', '$$$'],
    default: '$$'
  },
  isOpen: {
    type: Boolean,
    default: true
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required:true
  },
   menus:[{type:mongoose.Schema.Types.ObjectId , ref:'MenuItem'}],
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});


const Restaurant = mongoose.model<IRestaurant>('Restaurant', restaurantSchema);

export default Restaurant;
