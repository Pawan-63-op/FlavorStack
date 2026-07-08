import {
  cartAdapter,
  cartSummaryAdapter,
  type CartResponseDto,
  type CartSummaryResponse,
  type CartSummaryVM,
  type CartViewModel,
  type ValidatePromotionResponseDto,
} from "../adapters/cart";
import { client } from "../client/http";

interface MoneyInput {
  amount: number;
  currency?: string;
}

export interface AddCartItemInput {
  restaurantId: string;
  menuItemId: string;
  selectedOptionIds?: string[];
  quantity: number;
  /** Integer minor units (`addToCartSchema.unitPrice`); server trusts client-supplied price. */
  unitPrice: MoneyInput;
}

/**
 * Cart service — server-side cart over the composed API client (`server_2`
 * `/api/v1/cart`, all routes auth-only). Mutations return `200` with the full
 * updated cart (never `204`); every method re-mirrors via `cartAdapter`.
 */
class CartService {
  private readonly http = client;

  /** GET /cart → cartAdapter. */
  async getCart(): Promise<CartViewModel> {
    const dto = await this.http.get<CartResponseDto>("/cart");
    return cartAdapter(dto);
  }

  /** GET /cart/summary → cartSummaryAdapter (empty-safe, never 404). */
  async getSummary(): Promise<CartSummaryVM> {
    const dto = await this.http.get<CartSummaryResponse>("/cart/summary");
    return cartSummaryAdapter(dto);
  }

  /** POST /cart/items → cartAdapter. */
  async addItem(input: AddCartItemInput): Promise<CartViewModel> {
    const dto = await this.http.post<CartResponseDto>("/cart/items", { body: input });
    return cartAdapter(dto);
  }

  /** PATCH /cart/items/:itemId → cartAdapter (quantity 0 ⇒ remove). */
  async updateItem(cartItemId: string, quantity: number): Promise<CartViewModel> {
    const dto = await this.http.patch<CartResponseDto>(`/cart/items/${cartItemId}`, {
      body: { quantity },
    });
    return cartAdapter(dto);
  }

  /** DELETE /cart/items/:itemId → cartAdapter. */
  async removeItem(cartItemId: string): Promise<CartViewModel> {
    const dto = await this.http.del<CartResponseDto>(`/cart/items/${cartItemId}`);
    return cartAdapter(dto);
  }

  /** DELETE /cart → cartAdapter. */
  async clearCart(): Promise<CartViewModel> {
    const dto = await this.http.del<CartResponseDto>("/cart");
    return cartAdapter(dto);
  }

  /** POST /cart/promotion → cartAdapter (persists). */
  async applyPromotion(code: string): Promise<CartViewModel> {
    const dto = await this.http.post<CartResponseDto>("/cart/promotion", { body: { code } });
    return cartAdapter(dto);
  }

  /** POST /cart/promotion/validate → dry-run preview, never persisted. */
  async validatePromotion(code: string): Promise<ValidatePromotionResponseDto> {
    return this.http.post<ValidatePromotionResponseDto>("/cart/promotion/validate", {
      body: { code },
    });
  }

  /** DELETE /cart/promotion → cartAdapter. */
  async removePromotion(): Promise<CartViewModel> {
    const dto = await this.http.del<CartResponseDto>("/cart/promotion");
    return cartAdapter(dto);
  }
}

export const cartService = new CartService();
