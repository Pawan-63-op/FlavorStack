// Input DTOs for the catalog query use-cases (Catalog Phase 9). Queries are public
// reads, so these carry no actor/ownership context.
import { CuisineType } from '../../../domain/catalog/enums/cuisine-type.enum';
import { DietaryTag } from '../../../domain/catalog/enums/dietary-tag.enum';

export interface GetRestaurantDto {
  restaurantId: string;
}

export interface GetRestaurantBySlugDto {
  slug: string;
}

export interface ListRestaurantsDto {
  cuisineTypes?: CuisineType[];
  isOpen?: boolean;
  cursor?: string;
  limit?: number;
}

export interface GetRestaurantMenuDto {
  restaurantId: string;
}

export interface GetMenuItemDto {
  itemId: string;
}

export interface GetItemsSnapshotDto {
  itemIds: string[];
}

export interface CheckServiceabilityDto {
  lat: number;
  lng: number;
  subtotalAmount?: number;
  currency?: string;
}

// --- Catalog Phase 10: Search & Discovery ---

export interface SearchRestaurantsDto {
  query: string;
  cuisineTypes?: CuisineType[];
  isOpenNow?: boolean;
  cursor?: string;
  limit?: number;
}

export interface SearchMenuItemsDto {
  query: string;
  dietary?: DietaryTag[];
  isAvailable?: boolean;
  restaurantId?: string;
  cursor?: string;
  limit?: number;
}

export interface GetNearbyRestaurantsDto {
  lat: number;
  lng: number;
  radiusMeters: number;
  cuisineTypes?: CuisineType[];
  isOpenNow?: boolean;
  cursor?: string;
  limit?: number;
}
