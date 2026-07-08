/**
 * server_2 catalog **owner-write** menu-item DTO ⇄ admin form view-model.
 *
 * Mapping source: `my-app/integration_phases/Phase-10.md` → "Batch 10.0 —
 * Contract Verification Findings" (binding). Full application `MenuItemResponse`
 * shape (nested `basePrice`/`availability`/`variantGroups`/`version`) — distinct
 * from the flattened `MenuItemView` consumed by `./menu.ts`.
 *
 * ⚠️ `basePrice` (create) vs `price` (update) asymmetry (Batch 10.0 §6): the
 * add body carries `basePrice`, the update body carries `price` (sending
 * `basePrice` on update → stripped → 422). The response always reports
 * `basePrice`. Money is integer minor units on the wire (converted here).
 */
import { ApiError } from "../errors/ApiError";
import { formatMoney, type Money } from "../format/money";
import type { DietaryTag } from "./menu";
import {
  toMajorMoney,
  toMinorMoney,
  type MoneyResponse,
} from "./restaurantOwner";

export type SelectionType = "SINGLE" | "MULTI";

/** Server enum sets (Batch 10.0 §1). */
export const DIETARY_TAGS: readonly DietaryTag[] = [
  "VEG",
  "NON_VEG",
  "VEGAN",
  "EGG",
  "HALAL",
];
export const SELECTION_TYPES: readonly SelectionType[] = ["SINGLE", "MULTI"];

const VEG_DIETARY_TAGS: ReadonlySet<DietaryTag> = new Set(["VEG", "VEGAN"]);


export interface ItemOptionResponse {
  id: string;
  label: string;
  priceDelta: MoneyResponse;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface ItemVariantGroupResponse {
  id: string;
  label: string;
  selectionType: SelectionType;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: ItemOptionResponse[];
}

export interface ItemAvailabilityResponse {
  isAvailable: boolean;
  availableFrom?: string;
  availableUntil?: string;
  outOfStockReason?: string;
}

export interface OwnerMenuItemResponse {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  basePrice: MoneyResponse;
  tags: string[];
  dietary: DietaryTag[];
  availability: ItemAvailabilityResponse;
  variantGroups: ItemVariantGroupResponse[];
  version: number;
}


export interface ItemOptionView {
  id: string;
  label: string;
  priceDelta: Money;
  formattedPriceDelta: string;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface ItemVariantGroupView {
  id: string;
  label: string;
  selectionType: SelectionType;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: ItemOptionView[];
}

export interface OwnerMenuItemView {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  basePrice: Money;
  formattedBasePrice: string;
  tags: string[];
  dietary: DietaryTag[];
  isVegetarian: boolean;
  availability: ItemAvailabilityResponse;
  isAvailable: boolean;
  variantGroups: ItemVariantGroupView[];
  version: number;
}

export function ownerMenuItemAdapter(dto: OwnerMenuItemResponse): OwnerMenuItemView {
  const basePrice = toMajorMoney(dto.basePrice);
  return {
    id: dto.id,
    restaurantId: dto.restaurantId,
    categoryId: dto.categoryId,
    name: dto.name,
    description: dto.description,
    imageUrl: dto.imageUrl,
    basePrice,
    formattedBasePrice: formatMoney(basePrice),
    tags: dto.tags,
    dietary: dto.dietary,
    isVegetarian: dto.dietary.some((tag) => VEG_DIETARY_TAGS.has(tag)),
    availability: dto.availability,
    isAvailable: dto.availability.isAvailable,
    variantGroups: dto.variantGroups.map((group) => ({
      id: group.id,
      label: group.label,
      selectionType: group.selectionType,
      required: group.required,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      options: group.options.map((option) => {
        const priceDelta = toMajorMoney(option.priceDelta);
        return {
          id: option.id,
          label: option.label,
          priceDelta,
          formattedPriceDelta: formatMoney(priceDelta),
          isDefault: option.isDefault,
          isAvailable: option.isAvailable,
        };
      }),
    })),
    version: dto.version,
  };
}


function assertOneOf<T>(values: T[], allowed: readonly T[], field: string): void {
  for (const value of values) {
    if (!allowed.includes(value)) {
      throw new ApiError({
        status: 422,
        code: "VALIDATION_ERROR",
        message: `Invalid ${field}: ${String(value)}`,
      });
    }
  }
}

export function assertDietary(values: DietaryTag[]): void {
  assertOneOf(values, DIETARY_TAGS, "dietary");
}

export function assertSelectionType(value: SelectionType): void {
  assertOneOf([value], SELECTION_TYPES, "selectionType");
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key as keyof T] = value as T[keyof T];
  }
  return out;
}


export interface MenuItemFormValues {
  categoryId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  /** Major units. */
  basePrice: number;
  currency?: string;
  tags?: string[];
  dietary?: DietaryTag[];
}

export interface AddMenuItemBody {
  categoryId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  basePrice: { amount: number; currency?: string };
  tags?: string[];
  dietary?: DietaryTag[];
}

export function toAddMenuItemBody(form: MenuItemFormValues): AddMenuItemBody {
  if (form.dietary) assertDietary(form.dietary);
  return stripUndefined({
    categoryId: form.categoryId,
    name: form.name,
    description: form.description,
    imageUrl: form.imageUrl,
    basePrice: toMinorMoney(form.basePrice, form.currency),
    tags: form.tags,
    dietary: form.dietary,
  }) as AddMenuItemBody;
}

/** Update carries `price` (NOT `basePrice`) — see the file header / Batch 10.0 §6. */
export interface UpdateMenuItemInput {
  categoryId?: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  /** Major units. */
  price?: number;
  currency?: string;
  tags?: string[];
  dietary?: DietaryTag[];
}

export interface UpdateMenuItemBody {
  categoryId?: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  price?: { amount: number; currency?: string };
  tags?: string[];
  dietary?: DietaryTag[];
}

export function toUpdateMenuItemBody(input: UpdateMenuItemInput): UpdateMenuItemBody {
  if (input.dietary) assertDietary(input.dietary);
  const body = stripUndefined({
    categoryId: input.categoryId,
    name: input.name,
    description: input.description,
    imageUrl: input.imageUrl,
    price: input.price !== undefined ? toMinorMoney(input.price, input.currency) : undefined,
    tags: input.tags,
    dietary: input.dietary,
  }) as UpdateMenuItemBody;
  if (Object.keys(body).length === 0) {
    throw new ApiError({
      status: 422,
      code: "VALIDATION_ERROR",
      message: "No updatable fields provided",
    });
  }
  return body;
}


export interface AvailabilityInput {
  isAvailable: boolean;
  availableFrom?: string;
  availableUntil?: string;
  outOfStockReason?: string;
}
export type AvailabilityBody = AvailabilityInput;

export function toAvailabilityBody(input: AvailabilityInput): AvailabilityBody {
  return stripUndefined({ ...input }) as AvailabilityBody;
}


export interface VariantOptionInput {
  label: string;
  /** Major units. */
  priceDelta: number;
  isDefault?: boolean;
  isAvailable?: boolean;
}

export interface VariantGroupInput {
  label: string;
  selectionType: SelectionType;
  required?: boolean;
  minSelect: number;
  maxSelect: number;
  options?: VariantOptionInput[];
  currency?: string;
}

export interface SetVariantsBody {
  groups: {
    label: string;
    selectionType: SelectionType;
    required?: boolean;
    minSelect: number;
    maxSelect: number;
    options?: {
      label: string;
      priceDelta: { amount: number; currency?: string };
      isDefault?: boolean;
      isAvailable?: boolean;
    }[];
  }[];
}

export function toSetVariantsBody(groups: VariantGroupInput[]): SetVariantsBody {
  return {
    groups: groups.map((group) => {
      assertSelectionType(group.selectionType);
      return stripUndefined({
        label: group.label,
        selectionType: group.selectionType,
        required: group.required,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        options: group.options?.map((option) =>
          stripUndefined({
            label: option.label,
            priceDelta: toMinorMoney(option.priceDelta, group.currency),
            isDefault: option.isDefault,
            isAvailable: option.isAvailable,
          }),
        ),
      }) as SetVariantsBody["groups"][number];
    }),
  };
}
