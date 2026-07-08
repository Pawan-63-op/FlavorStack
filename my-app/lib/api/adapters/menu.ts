import { formatMoney, type Money } from "../format/money";
import {
  restaurantAdapter,
  type RestaurantSummaryResponse,
  type RestaurantViewModel,
} from "./restaurant";

/**
 * server_2 menu DTO → app menu view-model.
 *
 * Mapping source: `my-app/integration_phases/Phase_4.md` (verified server_2
 * contracts) — implemented in Phase 4 (restaurant discovery — menu listing).
 *
 * `basePriceAmount` is an integer in minor units (paise/cents); converted to
 * major units here (÷100) — the single place this conversion happens.
 */
export type DietaryTag = "VEG" | "NON_VEG" | "VEGAN" | "EGG" | "HALAL";

const VEG_DIETARY_TAGS: ReadonlySet<DietaryTag> = new Set(["VEG", "VEGAN"]);

function toMajor(minorAmount: number): number {
  return minorAmount / 100;
}

/** server_2 `MenuItemView` (`ReadModels.ts`). */
export interface MenuItemResponse {
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

/** server_2 `MenuItemSearchView` — `MenuItemView` + the owning restaurant's name/slug. */
export interface MenuItemSearchResponse extends MenuItemResponse {
  restaurantName: string;
  restaurantSlug: string;
}

export interface RestaurantMenuCategoryResponse {
  id: string;
  label: string;
  sortOrder: number;
  items: MenuItemResponse[];
}

/** server_2 `RestaurantMenuView`. */
export interface RestaurantMenuResponse {
  restaurant: RestaurantSummaryResponse;
  categories: RestaurantMenuCategoryResponse[];
}

export interface MenuItemViewModel {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price: Money;
  formattedPrice: string;
  /** Raw integer minor-unit price + currency — `addToCartSchema.unitPrice` wire shape. */
  unitPriceMinor: { amount: number; currency: string };
  dietary: DietaryTag[];
  isVegetarian: boolean;
  isAvailable: boolean;
  tags: string[];
}

export interface MenuItemSearchViewModel extends MenuItemViewModel {
  restaurantName: string;
  restaurantSlug: string;
}

export interface MenuCategoryViewModel {
  id: string;
  label: string;
  sortOrder: number;
  items: MenuItemViewModel[];
}

export interface MenuViewModel {
  restaurant: RestaurantViewModel;
  categories: MenuCategoryViewModel[];
}

export function menuItemAdapter(dto: MenuItemResponse): MenuItemViewModel {
  const price: Money = { amount: toMajor(dto.basePriceAmount), currency: dto.currency };
  return {
    id: dto.id,
    restaurantId: dto.restaurantId,
    categoryId: dto.categoryId,
    name: dto.name,
    description: dto.description,
    imageUrl: dto.imageUrl,
    price,
    formattedPrice: formatMoney(price),
    unitPriceMinor: { amount: dto.basePriceAmount, currency: dto.currency },
    dietary: dto.dietary,
    isVegetarian: dto.dietary.some((tag) => VEG_DIETARY_TAGS.has(tag)),
    isAvailable: dto.isAvailable,
    tags: dto.tags,
  };
}

export function menuItemSearchAdapter(dto: MenuItemSearchResponse): MenuItemSearchViewModel {
  return {
    ...menuItemAdapter(dto),
    restaurantName: dto.restaurantName,
    restaurantSlug: dto.restaurantSlug,
  };
}

export function menuAdapter(dto: RestaurantMenuResponse): MenuViewModel {
  return {
    restaurant: restaurantAdapter(dto.restaurant),
    categories: dto.categories.map((category) => ({
      id: category.id,
      label: category.label,
      sortOrder: category.sortOrder,
      items: category.items.map(menuItemAdapter),
    })),
  };
}
