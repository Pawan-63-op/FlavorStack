
import { Result } from '../../shared/Result';
import { Money } from '../../shared/Money';
import { GeoPoint } from '../../identity/value-objects/GeoPoint.vo';
import {
  CartMenuItemView,
  CartRestaurantView,
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

  /** Cart-time restaurant read: raw status/visibility/opening-hours/min-order, for the
   *  validator to turn into issues. Unlike `getRestaurantForCheckout` this does *not* fail
   *  on an unpublished restaurant — it resolves to `null` only when no such restaurant
   *  exists (or it was soft-deleted), so a paused or unlisted restaurant still renders. */
  getRestaurantForCart(restaurantId: string): Promise<Result<CartRestaurantView | null>>;

  /** Cart-time menu-item read carrying variant option groups, used both for cart validation
   *  and for resolving selected options at checkout. Order is not guaranteed and items that
   *  no longer exist are simply absent; callers match by `menuItemId`. */
  getItemsForCart(menuItemIds: string[]): Promise<Result<CartMenuItemView[]>>;
}
