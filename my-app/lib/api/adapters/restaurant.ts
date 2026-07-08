/**
 * server_2 restaurant DTO → app restaurant view-model.
 *
 * Mapping source: `my-app/integration_phases/Phase_4.md` (verified server_2
 * contracts) — implemented in Phase 4 (restaurant discovery).
 *
 * Server does not model `rating/deliveryTime/priceRange/city/country/address`
 * on the restaurant summary — never fabricate them here. `rating`/
 * `reviewCount` are optional and filled by a separate detail-only merge with
 * `/restaurants/:id/rating`, not derived from this DTO.
 */
export type CuisineType =
  | "NORTH_INDIAN"
  | "SOUTH_INDIAN"
  | "CHINESE"
  | "ITALIAN"
  | "MEXICAN"
  | "CONTINENTAL"
  | "FAST_FOOD"
  | "BAKERY"
  | "DESSERTS"
  | "BEVERAGES"
  | "SEAFOOD"
  | "STREET_FOOD";

export type RestaurantStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "CLOSED";

/** server_2 `RestaurantSummaryView` (`ReadModels.ts`). */
export interface RestaurantSummaryResponse {
  id: string;
  name: string;
  slug: string;
  cuisineTypes: CuisineType[];
  status: RestaurantStatus;
  isOpen: boolean;
  location: { lat: number; lng: number };
  imageUrl?: string;
}

const CUISINE_LABELS: Record<CuisineType, string> = {
  NORTH_INDIAN: "North Indian",
  SOUTH_INDIAN: "South Indian",
  CHINESE: "Chinese",
  ITALIAN: "Italian",
  MEXICAN: "Mexican",
  CONTINENTAL: "Continental",
  FAST_FOOD: "Fast Food",
  BAKERY: "Bakery",
  DESSERTS: "Desserts",
  BEVERAGES: "Beverages",
  SEAFOOD: "Seafood",
  STREET_FOOD: "Street Food",
};

export function cuisineLabel(cuisine: CuisineType): string {
  return CUISINE_LABELS[cuisine];
}

export interface RestaurantViewModel {
  id: string;
  name: string;
  slug: string;
  cuisineTypes: CuisineType[];
  /** Display label for `cuisineTypes[0]`; empty string if none. */
  cuisine: string;
  isOpen: boolean;
  status: RestaurantStatus;
  lat: number;
  lng: number;
  imageUrl?: string;
  /** Filled by a detail-only merge with `/restaurants/:id/rating`; never set from this DTO. */
  rating?: number;
  reviewCount?: number;
}

export function restaurantAdapter(dto: RestaurantSummaryResponse): RestaurantViewModel {
  return {
    id: dto.id,
    name: dto.name,
    slug: dto.slug,
    cuisineTypes: dto.cuisineTypes,
    cuisine: dto.cuisineTypes.length > 0 ? cuisineLabel(dto.cuisineTypes[0]) : "",
    isOpen: dto.isOpen,
    status: dto.status,
    lat: dto.location.lat,
    lng: dto.location.lng,
    imageUrl: dto.imageUrl,
  };
}
