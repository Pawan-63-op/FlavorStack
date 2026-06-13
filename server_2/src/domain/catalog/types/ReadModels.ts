import { CuisineType } from '../enums/cuisine-type.enum';
import { DietaryTag } from '../enums/dietary-tag.enum';
import { RestaurantStatus } from '../enums/restaurant-status.enum';

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
