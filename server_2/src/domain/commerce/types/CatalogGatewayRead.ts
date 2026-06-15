// Return contracts for ICatalogGateway (Commerce Phase 10) — the Commerce-owned,
// authoritative read shapes produced by the synchronous, query-only Catalog ACL at the
// checkout moment (commerce_module.md §3.4/§4.3/§4.4).
//
// SCOPE (reconciled in Phase 10 Batch 2): the ACL is limited to Catalog's three published
// read ports — ICatalogReadRepository, the CheckServiceability use case, and
// IOpeningHoursService. These contracts therefore carry ONLY what those ports authoritatively
// expose:
//   - restaurant existence / status / fresh open-state          (getRestaurantSummary + opening hours)
//   - item existence / base price / availability                (getItemsSnapshot -> MenuItemView)
//   - serviceability / resolved delivery fee / min order        (CheckServiceability)
//
// Deliberately NOT here (sourced elsewhere at checkout, NOT from the ACL):
//   - variant option price-deltas and validity, delivery-fee TIERS -> Commerce-local projection
//     (commerce_catalog_view, Phase 5)
//   - platform / packaging fees -> Commerce pricing config (PricingContext.restaurantFeeInputs)
//
// Types are Commerce-owned and decoupled from Catalog's read models (the infra adapter maps
// Catalog shapes -> these). Money is the shared VO; status is the Commerce-local mirror enum.

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

/** Authoritative serviceability + delivery-fee/min-order resolution for a delivery point and cart
 *  subtotal at the checkout moment, for a specific restaurant. When `serviceable` is false the
 *  monetary fields are zeroed and must not be used for pricing. */
export interface CheckoutServiceability {
  serviceable: boolean;
  distanceMeters: number;
  deliveryFee: Money;
  minOrder: Money;
}
