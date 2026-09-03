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

/** server_2 `VariantSelectionType`. `MULTI`, not `MULTIPLE` — match the enum exactly. */
export type VariantSelectionType = "SINGLE" | "MULTI";

/** server_2 `MenuItemVariantOptionView`. `priceDeltaAmount` is integer minor units. */
export interface VariantOptionResponse {
  id: string;
  label: string;
  priceDeltaAmount: number;
  currency: string;
  isDefault: boolean;
  isAvailable: boolean;
}

/** server_2 `MenuItemVariantGroupView`. */
export interface VariantGroupResponse {
  id: string;
  label: string;
  selectionType: VariantSelectionType;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: VariantOptionResponse[];
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
  /** Present on the list reads so the menu knows to open the variant picker. */
  hasVariants?: boolean;
}

/** server_2 `MenuItemDetailView` — what `GET /catalog/items/:id` returns. */
export interface MenuItemDetailResponse extends MenuItemResponse {
  variantGroups: VariantGroupResponse[];
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
  /** Drives whether "Add to Cart" opens the variant picker instead of adding directly. */
  hasVariants: boolean;
}

export interface VariantOptionViewModel {
  id: string;
  label: string;
  /** Integer minor units — added to the item's base price to form the cart `unitPrice`. */
  priceDeltaMinor: number;
  priceDelta: Money;
  /** "+₹100.00" / "Free" — ready to render beside the option. */
  formattedPriceDelta: string;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface VariantGroupViewModel {
  id: string;
  label: string;
  selectionType: VariantSelectionType;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: VariantOptionViewModel[];
}

export interface MenuItemDetailViewModel extends MenuItemViewModel {
  variantGroups: VariantGroupViewModel[];
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
    hasVariants: dto.hasVariants ?? false,
  };
}

function variantOptionAdapter(dto: VariantOptionResponse): VariantOptionViewModel {
  const priceDelta: Money = { amount: toMajor(dto.priceDeltaAmount), currency: dto.currency };
  return {
    id: dto.id,
    label: dto.label,
    priceDeltaMinor: dto.priceDeltaAmount,
    priceDelta,
    formattedPriceDelta:
      dto.priceDeltaAmount === 0 ? "Free" : `+${formatMoney(priceDelta)}`,
    isDefault: dto.isDefault,
    isAvailable: dto.isAvailable,
  };
}

/**
 * `GET /catalog/items/:id`. The picker needs option ids (posted as `selectedOptionIds`)
 * and the minor-unit deltas, which it sums onto `unitPriceMinor` so the cart line's
 * price matches what checkout recomputes from the catalog.
 */
export function menuItemDetailAdapter(dto: MenuItemDetailResponse): MenuItemDetailViewModel {
  const base = menuItemAdapter(dto);
  const groups = dto.variantGroups ?? [];
  return {
    ...base,
    // A detail read is authoritative about its own groups: trust the payload over the
    // list's projected `hasVariants`, which can lag a reprojection.
    hasVariants: groups.length > 0,
    variantGroups: groups.map((group) => ({
      id: group.id,
      label: group.label,
      selectionType: group.selectionType,
      required: group.required,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      options: group.options.map(variantOptionAdapter),
    })),
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
