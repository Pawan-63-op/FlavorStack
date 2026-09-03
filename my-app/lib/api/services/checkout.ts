import {
  checkoutPreviewAdapter,
  orderConfirmationAdapter,
  type CheckoutPreviewResponseDto,
  type CheckoutPreviewVM,
  type OrderConfirmationVM,
  type OrderRequestSummaryDto,
  type PaymentMethod,
} from "../adapters/checkout";
import { client } from "../client/http";
import { recordCheckoutFailure } from "../../observability/metrics";
import { getReporter } from "../../observability/reporter";

export interface PlaceOrderInput {
  paymentMethod: PaymentMethod;
  /** Id of one of the customer's saved addresses (`GET /users/me/addresses`). */
  addressId: string;
  /** Caller-supplied idempotency key; a UUID is generated if omitted. */
  idempotencyKey?: string;
}

export interface PlaceOrderResult {
  order: OrderConfirmationVM;
  /** The Idempotency-Key actually sent — persist this for safe retry. */
  idempotencyKeyUsed: string;
}

/**
 * Checkout service — server_2 `/api/v1/checkout*` (auth-only). Mirrors
 * `services/cart.ts`: one method per endpoint, each routed through its adapter.
 */
class CheckoutService {
  private readonly http = client;

  /**
   * Report a revenue-critical checkout failure to the observability layer and
   * rethrow unchanged. Captures the error (carrying the server `requestId`) and
   * counts the `checkout.failure` metric so the path stays observable in prod.
   */
  private reportFailure(operation: "preview" | "checkout", error: unknown): never {
    getReporter().captureError(error, { operation: `checkout.${operation}` });
    recordCheckoutFailure({ operation });
    throw error;
  }

  /**
   * POST /checkout/preview → checkoutPreviewAdapter. No Idempotency-Key.
   *
   * Sends the saved `addressId`, not coordinates: the server resolves the address (and so
   * the delivery fee) from the customer's own address book, and `checkout` resolves it the
   * same way — so the previewed total is the total that gets charged.
   */
  async preview(addressId: string): Promise<CheckoutPreviewVM> {
    try {
      const dto = await this.http.post<CheckoutPreviewResponseDto>("/checkout/preview", {
        body: { addressId },
      });
      return checkoutPreviewAdapter(dto);
    } catch (error) {
      this.reportFailure("preview", error);
    }
  }

  /** POST /checkout → orderConfirmationAdapter. Always sends Idempotency-Key. */
  async checkout(input: PlaceOrderInput): Promise<PlaceOrderResult> {
    const idempotencyKeyUsed = input.idempotencyKey ?? crypto.randomUUID();
    try {
      const dto = await this.http.post<OrderRequestSummaryDto>("/checkout", {
        body: {
          paymentMethod: input.paymentMethod,
          addressId: input.addressId,
        },
        headers: { "Idempotency-Key": idempotencyKeyUsed },
      });
      return { order: orderConfirmationAdapter(dto), idempotencyKeyUsed };
    } catch (error) {
      this.reportFailure("checkout", error);
    }
  }

  /** GET /order-requests/:id → orderConfirmationAdapter. */
  async getOrderRequest(id: string): Promise<OrderConfirmationVM> {
    const dto = await this.http.get<OrderRequestSummaryDto>(`/order-requests/${id}`);
    return orderConfirmationAdapter(dto);
  }
}

export const checkoutService = new CheckoutService();
