// Shapes for the commerce_catalog_view local projection (Commerce Phase 5).
//
// This is Commerce's own denormalized copy of the Catalog data needed for
// cart-time validation (restaurant status/visibility/open hours/delivery fee
// inputs, menu item price/variants/availability). It is intentionally a plain
// mirror of the subset of Catalog's domain shapes Commerce cares about — no
// types are imported from `domain/catalog` so the two contexts stay decoupled
// at the type level too.

export interface CommerceCatalogDayInterval {
  open: string; // "HH:mm"
  close: string; // "HH:mm"
}

export interface CommerceCatalogOpeningHoursView {
  schedule: Record<string, CommerceCatalogDayInterval[]>;
  holidays: string[]; // "YYYY-MM-DD"
}

export interface CommerceCatalogDeliveryFeeTierView {
  maxDistanceMeters: number;
  feeAmount: number;
  currency: string;
}

export interface CommerceCatalogDeliveryZoneView {
  deliveryZoneId: string;
  feeTiers: CommerceCatalogDeliveryFeeTierView[];
  freeAboveSubtotalAmount: number | null;
  minOrderAmount: number;
  currency: string;
}

export interface CommerceCatalogVariantOptionView {
  optionId: string;
  label: string;
  priceDeltaAmount: number;
  currency: string;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface CommerceCatalogVariantGroupView {
  groupId: string;
  label: string;
  selectionType: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: CommerceCatalogVariantOptionView[];
}

export interface CommerceCatalogMenuItemView {
  menuItemId: string;
  categoryId: string;
  name: string;
  basePriceAmount: number;
  currency: string;
  variantGroups: CommerceCatalogVariantGroupView[];
  isAvailable: boolean;
  outOfStockReason: string | null;
}

export interface CommerceCatalogRestaurantView {
  restaurantId: string;
  name: string;
  slug: string;
  status: string;
  visibility: string;
  openingHours: CommerceCatalogOpeningHoursView | null;
  tzOffsetMinutes: number;
  deliveryZones: CommerceCatalogDeliveryZoneView[];
  items: CommerceCatalogMenuItemView[];
  updatedAt: Date;
}
