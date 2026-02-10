/**
 * Shared types across the application
 * Re-exported from stores for convenience
 */

export type { Restaurant } from "../store/restaurantStore";
export type { MenuItem } from "../store/menuStore";
export type { Order, OrderItem, CartItem } from "../store/cartStore";
export type { Coupon } from "../store/couponStore";

/**
 * Common utility types
 */

export type OrderStatus = "pending" | "confirmed" | "preparing" | "Delivered" | "cancelled";
export type CouponType = "percentage" | "fixed" | "shipping";
export type PriceRange = "$" | "$$" | "$$$";

/**
 * API Response types
 */

export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Form state types
 */

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

/**
 * Image upload types
 */

export interface ImageUploadResult {
  url: string;
  publicId?: string;
  format?: string;
  width?: number;
  height?: number;
}
