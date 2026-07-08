
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
