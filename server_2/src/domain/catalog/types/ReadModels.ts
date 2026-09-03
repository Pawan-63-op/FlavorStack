import { CuisineType } from '../enums/cuisine-type.enum';
import { DietaryTag } from '../enums/dietary-tag.enum';
import { RestaurantStatus } from '../enums/restaurant-status.enum';
import { VariantSelectionType } from '../enums/variant-selection-type.enum';

export interface RestaurantSummaryView {
  id: string;
  name: string;
  slug: string;
  cuisineTypes: CuisineType[];
  status: RestaurantStatus;
  isOpen: boolean;
  location: { lat: number; lng: number };
  imageUrl?: string;
}

export interface MenuItemView {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  basePriceAmount: number;
  currency: string;
  tags: string[];
  dietary: DietaryTag[];
  isAvailable: boolean;
  /** True when the item has at least one variant group, so the UI opens a picker. */
  hasVariants: boolean;
}

/**
 * A selectable option inside a variant group (e.g. "Large", "Extra cheese").
 * `priceDeltaAmount` is in minor units, in the item's currency.
 */
export interface MenuItemVariantOptionView {
  id: string;
  label: string;
  priceDeltaAmount: number;
  currency: string;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface MenuItemVariantGroupView {
  id: string;
  label: string;
  selectionType: VariantSelectionType;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: MenuItemVariantOptionView[];
}

/**
 * `MenuItemView` plus the item's variant groups — the shape `GET /catalog/items/:id`
 * returns. The list views deliberately stay lean and carry only `hasVariants`, so the
 * customer variant picker fetches the groups for the one item it is opening.
 */
export interface MenuItemDetailView extends MenuItemView {
  variantGroups: MenuItemVariantGroupView[];
}

export interface RestaurantMenuCategoryView {
  id: string;
  label: string;
  sortOrder: number;
  items: MenuItemView[];
}

export interface RestaurantMenuView {
  restaurant: RestaurantSummaryView;
  categories: RestaurantMenuCategoryView[];
}

export interface MenuItemSearchView extends MenuItemView {
  restaurantName: string;
  restaurantSlug: string;
}

export interface MoneyView {
  amount: number;
  currency: string;
}

/**
 * A restaurant that delivers to a queried point, with the resolved delivery fee
 * and minimum order. Consumed by Cart (`CheckServiceability`).
 */
export interface ServiceableRestaurantView {
  restaurantId: string;
  name: string;
  slug: string;
  distanceMeters: number;
  deliveryFee: MoneyView;
  minOrder: MoneyView;
}
