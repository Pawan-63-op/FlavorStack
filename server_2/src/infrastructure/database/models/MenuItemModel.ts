import { Schema, model } from 'mongoose';
import { VARIANT_SELECTION_TYPE, VariantSelectionType } from '../../../domain/catalog/enums/variant-selection-type.enum';
import { MoneyDocument } from './RestaurantModel';

export interface ItemOptionDocument {
  id: string;
  label: string;
  priceDelta: MoneyDocument;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface ItemVariantGroupDocument {
  id: string;
  label: string;
  selectionType: VariantSelectionType;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: ItemOptionDocument[];
}

export interface ItemAvailabilityDocument {
  isAvailable: boolean;
  availableFrom: Date | null;
  availableUntil: Date | null;
  outOfStockReason: string | null;
}

export interface MenuItemDocument {
  _id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: MoneyDocument;
  tags: string[];
  dietary: string[];
  availability: ItemAvailabilityDocument;
  variantGroups: ItemVariantGroupDocument[];
  version: number;
  deletedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const MoneySchema = new Schema<MoneyDocument>(
  {
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
  },
  { _id: false }
);

const ItemOptionSchema = new Schema<ItemOptionDocument>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    priceDelta: { type: MoneySchema, required: true },
    isDefault: { type: Boolean, required: true },
    isAvailable: { type: Boolean, required: true },
  },
  { _id: false }
);

const ItemVariantGroupSchema = new Schema<ItemVariantGroupDocument>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    selectionType: { type: String, enum: Object.values(VARIANT_SELECTION_TYPE), required: true },
    required: { type: Boolean, required: true },
    minSelect: { type: Number, required: true },
    maxSelect: { type: Number, required: true },
    options: { type: [ItemOptionSchema], default: [] },
  },
  { _id: false }
);

const MenuItemSchema = new Schema<MenuItemDocument>(
  {
    _id: { type: String, required: true },
    restaurantId: { type: String, required: true },
    categoryId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    imageUrl: { type: String, default: null },
    basePrice: { type: MoneySchema, required: true },
    tags: { type: [String], default: [] },
    dietary: { type: [String], default: [] },
    availability: {
      isAvailable: { type: Boolean, required: true },
      availableFrom: { type: Date, default: null },
      availableUntil: { type: Date, default: null },
      outOfStockReason: { type: String, default: null },
    },
    variantGroups: { type: [ItemVariantGroupSchema], default: [] },
    version: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  {
    versionKey: false,
    timestamps: true,
    collection: 'menu_items',
  }
);

// Serves every "live items of a restaurant" read: `findByRestaurant` (cursor-paginated)
// and the source-of-truth menu/cart queries. `{deletedAt: 1}` below is sparse and so
// cannot cover `deletedAt: null` on its own. This also supersedes the former
// single-field `{restaurantId: 1}` index, which it covers as a prefix.
MenuItemSchema.index({ restaurantId: 1, deletedAt: 1 });
MenuItemSchema.index({ categoryId: 1 });
MenuItemSchema.index({ 'availability.isAvailable': 1 });
MenuItemSchema.index({ deletedAt: 1 }, { sparse: true });
MenuItemSchema.index({ name: 'text', description: 'text', tags: 'text' });

export const MenuItemModel = model<MenuItemDocument>('MenuItem', MenuItemSchema);
