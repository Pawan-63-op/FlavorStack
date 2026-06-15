// ACL port (Commerce Phase 10) — the synchronous, query-only, checkout-scoped read of Catalog's
// source-of-truth (commerce_module.md §3.4/§4.3/§4.4). This is the *only* sanctioned deviation
// from "cross-context via events only": it is used exactly at the checkout moment where an
// eventually-consistent projection cannot guarantee freshness. All cart-time reads go through the
// Commerce-local projection (ICommerceCatalogReadRepository) instead.
//
// The implementation (Phase 10 Batch 2) adapts Catalog's published read interfaces
// (ICatalogReadRepository, the CheckServiceability use case, IOpeningHoursService) and maps their
// shapes onto the Commerce-owned contracts below. It NEVER touches Catalog's write aggregates or
// repositories, and degrades cleanly to a network call at service-split time.
//
// Methods are async (the adapter performs I/O) and return Result<T> for expected failures
// (e.g. restaurant/item not found, not serviceable), matching the Catalog CheckServiceability
// use case's Promise<Result<T>> style.

import { Result } from '../../shared/Result';
import { Money } from '../../shared/Money';
import { GeoPoint } from '../../identity/value-objects/GeoPoint.vo';
import {
  CheckoutRestaurant,
  CheckoutMenuItem,
  CheckoutServiceability,
} from '../types/CatalogGatewayRead';

export interface ICatalogGateway {
  /** Authoritative restaurant read for checkout (status, fresh open state, fee + delivery-fee
   *  inputs). Fails with NotFoundError if no such restaurant is published. */
  getRestaurantForCheckout(restaurantId: string): Promise<Result<CheckoutRestaurant>>;

  /** Authoritative snapshot of the given menu items (base price, availability), re-derived rather
   *  than trusted from the cart cache. The returned array order is not guaranteed and items that no
   *  longer exist are simply absent; callers match by `menuItemId`. */
  getItemsSnapshot(menuItemIds: string[]): Promise<Result<CheckoutMenuItem[]>>;

  /** Authoritative serviceability + delivery-fee/min-order resolution for one restaurant given a
   *  delivery point and cart subtotal at the checkout moment. The cart is single-restaurant, so the
   *  caller passes `restaurantId`; if that restaurant does not serve the point the result has
   *  `serviceable: false`. */
  checkServiceability(
    restaurantId: string,
    point: GeoPoint,
    subtotal: Money
  ): Promise<Result<CheckoutServiceability>>;

  /** Fresh open/closed state for a restaurant at `at` (defaults to now). */
  isRestaurantOpen(restaurantId: string, at?: Date): Promise<Result<boolean>>;
}
