/**
 * Shared types across the application.
 *
 * The legacy `restaurantStore`/`menuStore` re-exports were removed in
 * Batch 10.3/10.4 — owner catalog data now flows through `@/lib/api`
 * view-models (`OwnerRestaurantView`/`OwnerMenuItemView`).
 */

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
