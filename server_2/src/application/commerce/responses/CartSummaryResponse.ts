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
