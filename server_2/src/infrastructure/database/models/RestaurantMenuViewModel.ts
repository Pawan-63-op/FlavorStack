// Read-model projection — `restaurant_menu_view` collection (Catalog Phase 9).
//
// The full menu tree for a restaurant detail page (restaurant header + categories
// + items), keyed by `restaurantId`. Rebuilt wholesale by the CatalogProjector.
// Item `isAvailable` is stored RAW (the item's own toggle); the read repository
// derives the effective availability at query time by ANDing it with the
// restaurant's open-state (an item auto-goes-unavailable when its restaurant is
// not ACTIVE/open).
import { Schema, model } from 'mongoose';
import { GeoJsonPoint, OpeningHoursDocument } from './RestaurantModel';

export interface MenuViewItemDocument {
  id: string;
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
}

export interface MenuViewCategoryDocument {
  id: string;
  label: string;
  sortOrder: number;
  items: MenuViewItemDocument[];
}

export interface RestaurantMenuViewDocument {
  _id: string; // restaurantId
  name: string;
  slug: string;
  cuisineTypes: string[];
  status: string;
  visibility: string;
  location: GeoJsonPoint;
  imageUrl: string | null;
  openingHours: OpeningHoursDocument | null;
  tzOffsetMinutes: number;
  categories: MenuViewCategoryDocument[];
  deletedAt: Date | null;
}

const MenuViewItemSchema = new Schema<MenuViewItemDocument>(
  {
    id: { type: String, required: true },
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
  },
  { _id: false }
);

const MenuViewCategorySchema = new Schema<MenuViewCategoryDocument>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    sortOrder: { type: Number, required: true },
    items: { type: [MenuViewItemSchema], default: [] },
  },
  { _id: false }
);

const RestaurantMenuViewSchema = new Schema<RestaurantMenuViewDocument>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    cuisineTypes: { type: [String], default: [] },
    status: { type: String, required: true },
    visibility: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true },
    },
    imageUrl: { type: String, default: null },
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
    categories: { type: [MenuViewCategorySchema], default: [] },
    deletedAt: { type: Date, default: null },
  },
  { versionKey: false, collection: 'restaurant_menu_view' }
);

RestaurantMenuViewSchema.index({ slug: 1 });
RestaurantMenuViewSchema.index({ deletedAt: 1 }, { sparse: true });

export const RestaurantMenuViewModel = model<RestaurantMenuViewDocument>(
  'RestaurantMenuView',
  RestaurantMenuViewSchema
);
