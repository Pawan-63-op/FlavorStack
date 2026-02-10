import { Request } from 'express';
import mongoose, { Document, Types } from 'mongoose';

export interface IUser extends Document {

  name: string;
  email: string;
  password: string;
  phone?: string;
  location?: string;
  bio?: string;
  birthday?: string;
  occupation?: string;
  avatar?: string;
  role: 'user' | 'admin';
  loyaltyPoints: number;
  loyaltyTier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  isActive: boolean;
  isVerified: boolean;
  resetPasswordToken?: string|undefined;
  resetPasswordExpire?: Date|undefined;
  matchPassword(enteredPassword: string): Promise<boolean>;
  updateLoyaltyTier(): void;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRestaurant extends Document {

  restaurantName: string;
  cuisine: string;
  description?: string;
  imageUrl?: string;
  rating: number;
  totalReviews: number;
  deliveryTime: string;
  city: string;
  country: string;
  priceRange: '$' | '$$' | '$$$';
  isOpen: boolean;
  owner?:Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  menus:Types.ObjectId[];
}

export interface IMenuItem extends Document {

  name: string;
  description: string;
  price: number;
  category: 'Appetizer' | 'Main Course' | 'Dessert' | 'Beverage' | 'Side';
  image?: string;
  isVegetarian: boolean;
  isSpicy: boolean;
  restaurant:Types.ObjectId;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
  calorie:number;
}

export interface IOrderItem {
  menuItem?:Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
}

export interface IOrder extends Document {

  orderId: string;
  user:Types.ObjectId;
  restaurant:Types.ObjectId;
  restaurantName: string;
  items: IOrderItem[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  discount: number;
  total: number;
  couponApplied?: {
    code: string;
    discount: number;
  };
  deliveryAddress: {
    name: string;
    phone: string;
    address: string;
  };
  paymentMethod: 'card' | 'cash' | 'wallet';
  status: 'pending' | 'confirmed' | 'preparing' | 'out-for-delivery' | 'Delivered' | 'cancelled';
  pointsEarned: number;
  hasReview: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReview extends Document {

  user:Types.ObjectId;
  restaurant:Types.ObjectId;
  order:Types.ObjectId;
  rating: number;
  comment: string;
  photos: string[];
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
  orderId : string;
}

export interface ICoupon extends Document {

  code: string;
  description: string;
  type: 'percentage' | 'fixed' | 'shipping';
  discount: number;
  minOrder: number;
  maxDiscount?: number;
  validFrom: Date;
  validUntil: Date;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
  createdBy?:Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFavoriteRestaurant {
  restaurant:Types.ObjectId;
  addedAt: Date;
}

export interface IFavoriteRecipe {
  recipe:Types.ObjectId;
  addedAt: Date;
}

export interface IFavorite extends Document {

  user:Types.ObjectId;
  restaurants: IFavoriteRestaurant[];
  recipes: IFavoriteRecipe[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ILoyaltyTransaction extends Document {

  user:Types.ObjectId;
  type: 'earned' | 'redeemed';
  points: number;
  description: string;
  order?:Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  r:any;
}

export interface IRecipe extends Document {

  name: string;
  description: string;
  image?: string;
  cookTime: string;
  servings: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: string;
  calories?: number;
  ingredients: string[];
  instructions: string[];
  tips?: string;
  createdBy?:Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthRequest extends Request {
  user?: IUser;
}


export interface EmailOptions {
  email: string | undefined;
  subject: string;
  html: string;
}

export interface LoyaltyTier {
  name: string;
  minPoints: number;
  benefits: string[];
}
