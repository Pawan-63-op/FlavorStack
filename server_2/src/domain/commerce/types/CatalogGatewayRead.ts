
import { Money } from '../../shared/Money';
import { CommerceRestaurantStatus } from '../enums/restaurant-status.enum';

/** Authoritative restaurant read at checkout, from the PUBLIC-filtered restaurant summary plus the
 *  time-derived open state. A non-existent or non-PUBLIC restaurant yields a NotFoundError, never a
 *  value. `isOpen` is the summary's time-aware open flag; the dedicated `isRestaurantOpen` method
 *  re-checks open-state for an explicit instant. */
export interface CheckoutRestaurant {
  restaurantId: string;
  name: string;
  status: CommerceRestaurantStatus;
  isOpen: boolean;
}

/** Authoritative menu-item read at checkout (existence, base price, availability), re-derived rather
 *  than trusted from the cart cache (invariant 4, Availability Revalidation). `restaurantId` lets the
 *  caller confirm the item still belongs to the cart's restaurant. Variant price-deltas/validity are
 *  resolved from the Commerce-local projection, not here. */
export interface CheckoutMenuItem {
  menuItemId: string;
  restaurantId: string;
  name: string;
  categoryId: string;
  basePrice: Money;
  isAvailable: boolean;
}

/* ------------------------------------------------------------------------------------------
 * Cart-time reads.
 *
 * Checkout re-derives everything from source; the cart page needs a wider, softer read — it
 * must be able to render a restaurant that is closed, paused or unlisted and explain why,
 * rather than fail. These shapes therefore carry the raw catalog state (status, visibility,
 * opening hours, min-order per zone, variant option groups) and leave every judgement to
 * `ICartValidator`.
 * ---------------------------------------------------------------------------------------- */

export interface CartDayIntervalView {
  open: string; // "HH:mm"
  close: string; // "HH:mm"
}

export interface CartOpeningHoursView {
  schedule: Record<string, CartDayIntervalView[]>;
  holidays: string[]; // "YYYY-MM-DD"
}

export interface CartDeliveryFeeTierView {
  maxDistanceMeters: number;
  feeAmount: number;
  currency: string;
}

export interface CartDeliveryZoneView {
  deliveryZoneId: string;
  feeTiers: CartDeliveryFeeTierView[];
  freeAboveSubtotalAmount: number | null;
  minOrderAmount: number;
  currency: string;
}

/** Restaurant-level state a cart is validated against. `status` and `visibility` are the raw
 *  catalog strings, not a commerce enum, because the validator maps them to customer-facing
 *  issue codes rather than gating on them. */
export interface CartRestaurantView {
  restaurantId: string;
  name: string;
  slug: string;
  status: string;
  visibility: string;
  openingHours: CartOpeningHoursView | null;
  /** Always `0` today — no restaurant carries a timezone offset yet, and both catalog
   *  projections hardcoded the same value. Kept in the shape so opening-hours evaluation
   *  has one place to become timezone-aware. */
  tzOffsetMinutes: number;
  deliveryZones: CartDeliveryZoneView[];
}

export interface CartVariantOptionView {
  optionId: string;
  label: string;
  priceDeltaAmount: number;
  currency: string;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface CartVariantGroupView {
  groupId: string;
  label: string;
  selectionType: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: CartVariantOptionView[];
}

/** A menu item as the cart and checkout-variant resolution need it: base price, availability
 *  and the full option groups. `isAvailable` is the item's own flag, deliberately *not* ANDed
 *  with restaurant open-state — the validator reports a closed restaurant separately. */
export interface CartMenuItemView {
  menuItemId: string;
  /** Lets the cart reject an item that has moved to another restaurant, which the old
   *  per-restaurant projection expressed implicitly by simply not containing it. */
  restaurantId: string;
  categoryId: string;
  name: string;
  basePriceAmount: number;
  currency: string;
  variantGroups: CartVariantGroupView[];
  isAvailable: boolean;
  outOfStockReason: string | null;
}

/** A restaurant plus the cart's own items — what `ICartValidator` and the cart response are
 *  built from. Assembled by the caller from `getRestaurantForCart` + `getItemsForCart`; only
 *  the items a cart actually references are fetched, never the whole menu. */
export interface CartCatalogView extends CartRestaurantView {
  items: CartMenuItemView[];
}

/** Authoritative serviceability + delivery-fee/min-order resolution for a delivery point and cart
 *  subtotal at the checkout moment, for a specific restaurant. When `serviceable` is false the
 *  monetary fields are zeroed and must not be used for pricing. */
export interface CheckoutServiceability {
  serviceable: boolean;
  distanceMeters: number;
  deliveryFee: Money;
  minOrder: Money;
}
