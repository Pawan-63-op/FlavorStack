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
  /** When set, `lat`/`lng` are required and only restaurants that deliver there are returned. */
  deliverableOnly?: boolean;
  lat?: number;
  lng?: number;
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

export interface ListDeliverableRestaurantsDto {
  lat: number;
  lng: number;
}

export interface CheckServiceabilityDto {
  lat: number;
  lng: number;
  subtotalAmount?: number;
  currency?: string;
}


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
  /** Return only restaurants whose delivery zone covers `lat`/`lng`. */
  deliverableOnly?: boolean;
}
