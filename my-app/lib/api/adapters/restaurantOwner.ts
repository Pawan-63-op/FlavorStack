/**
 * server_2 catalog **owner-write** restaurant DTO ⇄ admin form view-model.
 *
 * Mapping source: `my-app/integration_phases/Phase-10.md` → "Batch 10.0 —
 * Contract Verification Findings" (binding). These are the FULL application
 * `RestaurantResponse` shapes returned by the owner-write endpoints — distinct
 * from the flattened `RestaurantSummaryView` consumed by the public discovery
 * adapter in `./restaurant.ts`.
 *
 * Money is integer **minor units** on the wire; the admin form edits major
 * units. Conversion happens here (the single place) — see {@link toMinorMoney}
 * / {@link toMajorMoney}. Enum inputs are validated fail-fast against the
 * server enum sets before a request body is built.
 */
import { ApiError } from "../errors/ApiError";
import { formatMoney, type Money } from "../format/money";
import type { CuisineType, RestaurantStatus } from "./restaurant";

export type CatalogVisibility = "PUBLIC" | "HIDDEN" | "TEST";
export type DeliveryZoneAction = "ADD" | "UPDATE" | "REMOVE";
export type Weekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

/** Server enum sets (Batch 10.0 §1) — the source of truth for FE form options. */
export const CUISINE_TYPES: readonly CuisineType[] = [
  "NORTH_INDIAN",
  "SOUTH_INDIAN",
  "CHINESE",
  "ITALIAN",
  "MEXICAN",
  "CONTINENTAL",
  "FAST_FOOD",
  "BAKERY",
  "DESSERTS",
  "BEVERAGES",
  "SEAFOOD",
  "STREET_FOOD",
];
export const CATALOG_VISIBILITIES: readonly CatalogVisibility[] = [
  "PUBLIC",
  "HIDDEN",
  "TEST",
];
export const DELIVERY_ZONE_ACTIONS: readonly DeliveryZoneAction[] = [
  "ADD",
  "UPDATE",
  "REMOVE",
];
export const WEEKDAYS: readonly Weekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];


/** Wire money: integer minor units + 3-letter currency. */
export interface MoneyResponse {
  amount: number;
  currency: string;
}

/** Major units → wire money (minor units). Currency omitted unless provided. */
export function toMinorMoney(major: number, currency?: string): {
  amount: number;
  currency?: string;
} {
  const body: { amount: number; currency?: string } = {
    amount: Math.round(major * 100),
  };
  if (currency) body.currency = currency;
  return body;
}

/** Wire money (minor units) → app `Money` in major units. */
export function toMajorMoney(money: MoneyResponse): Money {
  return { amount: money.amount / 100, currency: money.currency };
}


export interface AddressResponse {
  label?: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  coordinates: { lat: number; lng: number };
}

export interface OwnerCategoryResponse {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export interface DeliveryZoneTierResponse {
  maxDistanceMeters: number;
  fee: MoneyResponse;
}

export interface DeliveryZoneResponse {
  id: string;
  polygon: { points: { lat: number; lng: number }[] };
  feeMatrix: {
    tiers: DeliveryZoneTierResponse[];
    freeAboveSubtotal?: MoneyResponse;
  };
  minOrder: MoneyResponse;
}

export type WeeklyScheduleResponse = Partial<
  Record<Weekday, { open: string; close: string }[]>
>;

export interface OwnerOpeningHoursResponse {
  schedule: WeeklyScheduleResponse;
  holidays: string[];
}

export interface OwnerRestaurantResponse {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description?: string;
  cuisineTypes: CuisineType[];
  address: AddressResponse;
  location: { lat: number; lng: number };
  phone: string;
  imageUrl?: string;
  status: RestaurantStatus;
  visibility: CatalogVisibility;
  categories: OwnerCategoryResponse[];
  openingHours?: OwnerOpeningHoursResponse;
  deliveryZones: DeliveryZoneResponse[];
  version: number;
}


export interface DeliveryZoneTierView {
  maxDistanceMeters: number;
  fee: Money;
  formattedFee: string;
}

export interface DeliveryZoneView {
  id: string;
  polygon: { lat: number; lng: number }[];
  tiers: DeliveryZoneTierView[];
  freeAboveSubtotal?: Money;
  minOrder: Money;
  formattedMinOrder: string;
}

export interface OwnerRestaurantView {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description?: string;
  cuisineTypes: CuisineType[];
  address: AddressResponse;
  location: { lat: number; lng: number };
  phone: string;
  imageUrl?: string;
  status: RestaurantStatus;
  visibility: CatalogVisibility;
  /** Sorted by `sortOrder` for stable display. */
  categories: OwnerCategoryResponse[];
  /** True when at least one active category exists — gates the publish action (publish needs ≥1). */
  canPublish: boolean;
  openingHours?: OwnerOpeningHoursResponse;
  deliveryZones: DeliveryZoneView[];
  version: number;
}

export function ownerRestaurantAdapter(
  dto: OwnerRestaurantResponse,
): OwnerRestaurantView {
  const categories = [...dto.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    id: dto.id,
    ownerId: dto.ownerId,
    name: dto.name,
    slug: dto.slug,
    description: dto.description,
    cuisineTypes: dto.cuisineTypes,
    address: dto.address,
    location: dto.location,
    phone: dto.phone,
    imageUrl: dto.imageUrl,
    status: dto.status,
    visibility: dto.visibility,
    categories,
    canPublish: categories.some((c) => c.isActive),
    openingHours: dto.openingHours,
    deliveryZones: dto.deliveryZones.map(deliveryZoneAdapter),
    version: dto.version,
  };
}

function deliveryZoneAdapter(dto: DeliveryZoneResponse): DeliveryZoneView {
  const minOrder = toMajorMoney(dto.minOrder);
  return {
    id: dto.id,
    polygon: dto.polygon.points,
    tiers: dto.feeMatrix.tiers.map((tier) => {
      const fee = toMajorMoney(tier.fee);
      return {
        maxDistanceMeters: tier.maxDistanceMeters,
        fee,
        formattedFee: formatMoney(fee),
      };
    }),
    freeAboveSubtotal: dto.feeMatrix.freeAboveSubtotal
      ? toMajorMoney(dto.feeMatrix.freeAboveSubtotal)
      : undefined,
    minOrder,
    formattedMinOrder: formatMoney(minOrder),
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

export function assertCuisineTypes(values: CuisineType[]): void {
  assertOneOf(values, CUISINE_TYPES, "cuisineTypes");
}

export function assertVisibility(value: CatalogVisibility): void {
  assertOneOf([value], CATALOG_VISIBILITIES, "visibility");
}

export function assertZoneAction(value: DeliveryZoneAction): void {
  assertOneOf([value], DELIVERY_ZONE_ACTIONS, "action");
}


export interface RestaurantFormValues {
  name: string;
  /** Optional — server auto-derives a slug from `name` when omitted. */
  slug?: string;
  description?: string;
  cuisineTypes: CuisineType[];
  address: AddressResponse;
  location: { lat: number; lng: number };
  phone: string;
  imageUrl?: string;
}

export interface CreateRestaurantBody {
  name: string;
  slug?: string;
  description?: string;
  cuisineTypes: CuisineType[];
  address: AddressResponse;
  location: { lat: number; lng: number };
  phone: string;
  imageUrl?: string;
}

/** Update accepts the same fields except `slug` (immutable post-create). */
export type UpdateRestaurantInput = Partial<Omit<RestaurantFormValues, "slug">>;
export type UpdateRestaurantBody = Partial<Omit<CreateRestaurantBody, "slug">>;

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key as keyof T] = value as T[keyof T];
  }
  return out;
}

export function toCreateRestaurantBody(
  form: RestaurantFormValues,
): CreateRestaurantBody {
  assertCuisineTypes(form.cuisineTypes);
  return stripUndefined({
    name: form.name,
    slug: form.slug,
    description: form.description,
    cuisineTypes: form.cuisineTypes,
    address: form.address,
    location: form.location,
    phone: form.phone,
    imageUrl: form.imageUrl,
  }) as CreateRestaurantBody;
}

export function toUpdateRestaurantBody(
  input: UpdateRestaurantInput,
): UpdateRestaurantBody {
  if (input.cuisineTypes) assertCuisineTypes(input.cuisineTypes);
  const body = stripUndefined({
    name: input.name,
    description: input.description,
    cuisineTypes: input.cuisineTypes,
    address: input.address,
    location: input.location,
    phone: input.phone,
    imageUrl: input.imageUrl,
  }) as UpdateRestaurantBody;
  if (Object.keys(body).length === 0) {
    throw new ApiError({
      status: 422,
      code: "VALIDATION_ERROR",
      message: "No updatable fields provided",
    });
  }
  return body;
}


export interface CategoryFormValues {
  label: string;
  sortOrder?: number;
}
export interface AddCategoryBody {
  label: string;
  sortOrder?: number;
}
export interface UpdateCategoryInput {
  label?: string;
  sortOrder?: number;
  isActive?: boolean;
}
export type UpdateCategoryBody = UpdateCategoryInput;

export function toAddCategoryBody(form: CategoryFormValues): AddCategoryBody {
  return stripUndefined({ label: form.label, sortOrder: form.sortOrder }) as AddCategoryBody;
}

export function toUpdateCategoryBody(input: UpdateCategoryInput): UpdateCategoryBody {
  const body = stripUndefined({ ...input }) as UpdateCategoryBody;
  if (Object.keys(body).length === 0) {
    throw new ApiError({
      status: 422,
      code: "VALIDATION_ERROR",
      message: "No updatable fields provided",
    });
  }
  return body;
}


export interface OpeningHoursInput {
  schedule: WeeklyScheduleResponse;
  holidays?: string[];
}
export interface OpeningHoursBody {
  schedule: WeeklyScheduleResponse;
  holidays?: string[];
}

export function toOpeningHoursBody(input: OpeningHoursInput): OpeningHoursBody {
  return stripUndefined({
    schedule: input.schedule,
    holidays: input.holidays,
  }) as OpeningHoursBody;
}


export interface ZoneFeeTierInput {
  maxDistanceMeters: number;
  /** Major units. */
  fee: number;
}

export interface ManageZoneInput {
  action: DeliveryZoneAction;
  zoneId?: string;
  polygon?: { lat: number; lng: number }[];
  feeMatrix?: {
    tiers: ZoneFeeTierInput[];
    /** Major units. */
    freeAboveSubtotal?: number;
  };
  /** Major units. */
  minOrder?: number;
  currency?: string;
}

export interface ManageZoneBody {
  action: DeliveryZoneAction;
  zoneId?: string;
  polygon?: { lat: number; lng: number }[];
  feeMatrix?: {
    tiers: { maxDistanceMeters: number; fee: { amount: number; currency?: string } }[];
    freeAboveSubtotal?: { amount: number; currency?: string };
  };
  minOrder?: { amount: number; currency?: string };
}

export function toManageZoneBody(input: ManageZoneInput): ManageZoneBody {
  assertZoneAction(input.action);
  const body: ManageZoneBody = { action: input.action };
  if (input.zoneId !== undefined) body.zoneId = input.zoneId;
  if (input.polygon !== undefined) body.polygon = input.polygon;
  if (input.feeMatrix !== undefined) {
    body.feeMatrix = {
      tiers: input.feeMatrix.tiers.map((tier) => ({
        maxDistanceMeters: tier.maxDistanceMeters,
        fee: toMinorMoney(tier.fee, input.currency),
      })),
      ...(input.feeMatrix.freeAboveSubtotal !== undefined
        ? { freeAboveSubtotal: toMinorMoney(input.feeMatrix.freeAboveSubtotal, input.currency) }
        : {}),
    };
  }
  if (input.minOrder !== undefined) {
    body.minOrder = toMinorMoney(input.minOrder, input.currency);
  }
  return body;
}
