// Output DTO: CartSummary — lightweight { itemCount, total } for a header/badge,
// derived from `carts` (Phase 13). `itemCount` is the sum of line quantities;
// `total` is the cart subtotal (null for an empty/absent cart). Designed to be
// safe to call on every page render: an absent active cart yields an empty summary
// (cartId/total/currency null, itemCount 0) rather than a 404, since a badge is
// always rendered.
import { Cart } from '../../../domain/commerce/entities/Cart';

export interface MoneyResponse {
  amount: number;
  currency: string;
}

export interface CartSummaryResponse {
  cartId: string | null;
  itemCount: number;
  total: MoneyResponse | null;
  currency: string | null;
}

export function emptyCartSummary(): CartSummaryResponse {
  return { cartId: null, itemCount: 0, total: null, currency: null };
}

export function toCartSummaryResponse(cart: Cart): CartSummaryResponse {
  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity.value, 0);

  if (cart.isEmpty) {
    return { cartId: cart.id.toString(), itemCount, total: null, currency: null };
  }

  const subtotalResult = cart.calculateSubtotal();
  if (subtotalResult.isFailure) {
    return { cartId: cart.id.toString(), itemCount, total: null, currency: cart.currency };
  }

  const subtotal = subtotalResult.getValue();
  return {
    cartId: cart.id.toString(),
    itemCount,
    total: { amount: subtotal.amount, currency: subtotal.currency },
    currency: cart.currency,
  };
}
