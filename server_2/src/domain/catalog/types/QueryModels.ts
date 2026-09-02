import { RestaurantStatus } from '../enums/restaurant-status.enum';
import { CatalogVisibility } from '../enums/catalog-visibility.enum';
import { VariantSelectionType } from '../enums/variant-selection-type.enum';

/**
 * Flat, read-only records returned by `ICatalogQueryRepository` — the source-of-truth
 * query contract over `restaurants` + `menu_items`.
 *
 * These are deliberately *not* domain aggregates: callers here need field access, not
 * behaviour, so the repository maps lean Mongo documents straight across instead of
 * paying for aggregate hydration. They are also *not* read models — nothing projects
 * them; they are the write collections read in a query shape.
 */

export interface CatalogQueryMoney {
  amount: number;
  currency: string;
}

export interface CatalogQueryGeoPoint {
  lat: number;
  lng: number;
}

export interface CatalogQueryDayInterval {
  open: string; // "HH:mm"
  close: string; // "HH:mm"
}

export interface CatalogQueryOpeningHours {
  schedule: Record<string, CatalogQueryDayInterval[]>;
  holidays: string[]; // "YYYY-MM-DD"
}

export interface CatalogQueryCategory {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CatalogQueryDeliveryFeeTier {
  maxDistanceMeters: number;
  fee: CatalogQueryMoney;
}

export interface CatalogQueryDeliveryZone {
  id: string;
  feeTiers: CatalogQueryDeliveryFeeTier[];
  freeAboveSubtotal: CatalogQueryMoney | null;
  minOrder: CatalogQueryMoney;
}

export interface CatalogQueryRestaurant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cuisineTypes: string[];
  status: RestaurantStatus;
  visibility: CatalogVisibility;
  imageUrl: string | null;
  location: CatalogQueryGeoPoint;
  openingHours: CatalogQueryOpeningHours | null;
  categories: CatalogQueryCategory[];
  deliveryZones: CatalogQueryDeliveryZone[];
}

export interface CatalogQueryVariantOption {
  id: string;
  label: string;
  priceDelta: CatalogQueryMoney;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface CatalogQueryVariantGroup {
  id: string;
  label: string;
  selectionType: VariantSelectionType;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: CatalogQueryVariantOption[];
}

export interface CatalogQueryMenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: CatalogQueryMoney;
  tags: string[];
  dietary: string[];
  isAvailable: boolean;
  outOfStockReason: string | null;
  variantGroups: CatalogQueryVariantGroup[];
}
