// Input DTO: UpdateCartItem — { customerId, cartItemId, quantity }
// quantity === 0 removes the line (Quantity VO has no zero value).
export interface UpdateCartItemDto {
  customerId: string;
  cartItemId: string;
  quantity: number;
}
