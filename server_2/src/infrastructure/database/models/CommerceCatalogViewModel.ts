// Mongoose schema — `commerce_catalog_view` collection (Commerce Phase 5).
//
// Commerce's own local projection of Catalog truth: restaurant status/visibility/
// open hours/delivery fee inputs, plus each menu item's price/variants/availability.
// Rebuilt wholesale per-restaurant by `CommerceCatalogProjector`, keyed by
// `restaurantId`. Read by `ICartValidator` (Phase 6) for cart-time validation;
// checkout (Phase 10+) re-reads Catalog directly via `ICatalogGateway` instead.
import { Schema, model } from 'mongoose';

export interface CommerceCatalogDayIntervalDocument {
  open: string;
  close: string;
}

export interface CommerceCatalogOpeningHoursDocument {
  schedule: Record<string, CommerceCatalogDayIntervalDocument[]>;
  holidays: string[];
}

export interface CommerceCatalogDeliveryFeeTierDocument {
  maxDistanceMeters: number;
  feeAmount: number;
  currency: string;
}

export interface CommerceCatalogDeliveryZoneDocument {
  deliveryZoneId: string;
  feeTiers: CommerceCatalogDeliveryFeeTierDocument[];
  freeAboveSubtotalAmount: number | null;
  minOrderAmount: number;
  currency: string;
}

export interface CommerceCatalogVariantOptionDocument {
  optionId: string;
  label: string;
  priceDeltaAmount: number;
  currency: string;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface CommerceCatalogVariantGroupDocument {
  groupId: string;
  label: string;
  selectionType: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: CommerceCatalogVariantOptionDocument[];
}

export interface CommerceCatalogMenuItemDocument {
  menuItemId: string;
  categoryId: string;
  name: string;
  basePriceAmount: number;
  currency: string;
  variantGroups: CommerceCatalogVariantGroupDocument[];
  isAvailable: boolean;
  outOfStockReason: string | null;
}

export interface CommerceCatalogViewDocument {
  _id: string; // restaurantId
  name: string;
  slug: string;
  status: string;
  visibility: string;
  openingHours: CommerceCatalogOpeningHoursDocument | null;
  tzOffsetMinutes: number;
  deliveryZones: CommerceCatalogDeliveryZoneDocument[];
  items: CommerceCatalogMenuItemDocument[];
  updatedAt: Date;
}

const CommerceCatalogVariantOptionSchema = new Schema<CommerceCatalogVariantOptionDocument>(
  {
    optionId: { type: String, required: true },
    label: { type: String, required: true },
    priceDeltaAmount: { type: Number, required: true },
    currency: { type: String, required: true },
    isDefault: { type: Boolean, required: true },
    isAvailable: { type: Boolean, required: true },
  },
  { _id: false }
);

const CommerceCatalogVariantGroupSchema = new Schema<CommerceCatalogVariantGroupDocument>(
  {
    groupId: { type: String, required: true },
    label: { type: String, required: true },
    selectionType: { type: String, required: true },
    required: { type: Boolean, required: true },
    minSelect: { type: Number, required: true },
    maxSelect: { type: Number, required: true },
    options: { type: [CommerceCatalogVariantOptionSchema], default: [] },
  },
  { _id: false }
);

const CommerceCatalogMenuItemSchema = new Schema<CommerceCatalogMenuItemDocument>(
  {
    menuItemId: { type: String, required: true },
    categoryId: { type: String, required: true },
    name: { type: String, required: true },
    basePriceAmount: { type: Number, required: true },
    currency: { type: String, required: true },
    variantGroups: { type: [CommerceCatalogVariantGroupSchema], default: [] },
    isAvailable: { type: Boolean, required: true },
    outOfStockReason: { type: String, default: null },
  },
  { _id: false }
);

const CommerceCatalogDeliveryFeeTierSchema = new Schema<CommerceCatalogDeliveryFeeTierDocument>(
  {
    maxDistanceMeters: { type: Number, required: true },
    feeAmount: { type: Number, required: true },
    currency: { type: String, required: true },
  },
  { _id: false }
);

const CommerceCatalogDeliveryZoneSchema = new Schema<CommerceCatalogDeliveryZoneDocument>(
  {
    deliveryZoneId: { type: String, required: true },
    feeTiers: { type: [CommerceCatalogDeliveryFeeTierSchema], default: [] },
    freeAboveSubtotalAmount: { type: Number, default: null },
    minOrderAmount: { type: Number, required: true },
    currency: { type: String, required: true },
  },
  { _id: false }
);

const CommerceCatalogViewSchema = new Schema<CommerceCatalogViewDocument>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    status: { type: String, required: true },
    visibility: { type: String, required: true },
    openingHours: {
      type: new Schema(
        {
          schedule: { type: Schema.Types.Mixed, required: true },
          holidays: { type: [String], default: [] },
        },
        { _id: false }
      ),
      default: null,
    },
    tzOffsetMinutes: { type: Number, default: 0 },
    deliveryZones: { type: [CommerceCatalogDeliveryZoneSchema], default: [] },
    items: { type: [CommerceCatalogMenuItemSchema], default: [] },
    updatedAt: { type: Date, required: true },
  },
  { versionKey: false, collection: 'commerce_catalog_view' }
);

CommerceCatalogViewSchema.index({ 'items.menuItemId': 1 });

export const CommerceCatalogViewModel = model<CommerceCatalogViewDocument>(
  'CommerceCatalogView',
  CommerceCatalogViewSchema
);
