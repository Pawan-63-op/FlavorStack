import mongoose, { Schema } from 'mongoose';
import { IMenuItem } from "@/Types/allTypes";

const menuItemSchema = new Schema<IMenuItem>({

  name: {
    type: String,
    required: [true, 'Please add a menu item name'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Please add a description']
  },
  price: {
    type: Number,
    required: [true, 'Please add a price'],
    min: 0
  },
  category: {
    type: String,
    required: [true, 'Please add a category'],
    enum: ['Appetizer', 'Main Course', 'Dessert', 'Beverage', 'Side']
  },
  image: {
    type: String,
    default: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'
  },
  isVegetarian: {
    type: Boolean,
    default: false
  },
  isSpicy: {
    type: Boolean,
    default: false
  },
  restaurant: {
    type: Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  calorie: { type: Number, default: 0 }
  
}, {
  timestamps: true
});

const MenuItem = mongoose.model<IMenuItem>('MenuItem', menuItemSchema);

export default MenuItem;
