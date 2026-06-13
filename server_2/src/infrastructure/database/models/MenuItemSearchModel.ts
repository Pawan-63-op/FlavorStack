// Read-model projection — `menu_item_search` collection (Catalog Phase 9).
//
// Flat, denormalized item document carrying its restaurant context, used for item
// search (Phase 10) and item-level reads (`GetMenuItem`, `GetItemsSnapshot`).
// Rebuilt per-restaurant by the CatalogProjector: on rebuild the restaurant's old
// search docs are replaced by the current item set (so removed items disappear).
// `isAvailable` is the raw item toggle; effective availability is derived at read.
import { Schema, model } from 'mongoose';

export interface MenuItemSearchDocument {
  _id: string; // itemId
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePriceAmount: number;
  currency: string;
  tags: string[];
  dietary: string[];
  isAvailable: boolean;
  restaurantName: string;
  restaurantSlug: string;
  restaurantStatus: string;
  restaurantVisibility: string;
  deletedAt: Date | null;
}

const MenuItemSearchSchema = new Schema<MenuItemSearchDocument>(
  {
    _id: { type: String, required: true },
    restaurantId: { type: String, required: true },
    categoryId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    imageUrl: { type: String, default: null },
    basePriceAmount: { type: Number, required: true },
    currency: { type: String, required: true },
    tags: { type: [String], default: [] },
    dietary: { type: [String], default: [] },
    isAvailable: { type: Boolean, required: true },
    restaurantName: { type: String, required: true },
    restaurantSlug: { type: String, required: true },
    restaurantStatus: { type: String, required: true },
    restaurantVisibility: { type: String, required: true },
    deletedAt: { type: Date, default: null },
  },
  { versionKey: false, collection: 'menu_item_search' }
);

MenuItemSearchSchema.index({ restaurantId: 1 });
MenuItemSearchSchema.index({ restaurantStatus: 1, restaurantVisibility: 1 });
MenuItemSearchSchema.index({ 'isAvailable': 1 });
MenuItemSearchSchema.index({ deletedAt: 1 }, { sparse: true });
MenuItemSearchSchema.index({ name: 'text', description: 'text', tags: 'text' });

export const MenuItemSearchModel = model<MenuItemSearchDocument>(
  'MenuItemSearch',
  MenuItemSearchSchema
);
