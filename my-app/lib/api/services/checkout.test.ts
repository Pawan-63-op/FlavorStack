import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckoutPreviewResponseDto, OrderRequestSummaryDto } from "../adapters/checkout";
import { ApiError } from "../errors/ApiError";
import { client } from "../client/http";
import {
  resetReporter,
  setReporter,
  type Reporter,
} from "../../observability/reporter";
import { checkoutService } from "./checkout";

vi.mock("../client/http", () => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
    raw: vi.fn(),
  },
}));

vi.stubGlobal("crypto", { randomUUID: () => "generated-uuid" });

function makePreviewDto(overrides: Partial<CheckoutPreviewResponseDto> = {}): CheckoutPreviewResponseDto {
  return {
    restaurantId: "r1",
    lines: [],
    pricing: {
      subtotal: { amount: 0, currency: "INR" },
      fees: [],
      discount: { amount: 0, currency: "INR" },
      tax: { amount: 0, currency: "INR" },
      total: { amount: 0, currency: "INR" },
    },
    serviceable: true,
    distanceMeters: 100,
    deliveryFee: { amount: 0, currency: "INR" },
    minOrder: { amount: 0, currency: "INR" },
    promotion: null,
    ...overrides,
  };
}

function makeSummaryDto(overrides: Partial<OrderRequestSummaryDto> = {}): OrderRequestSummaryDto {
  return {
    orderRequestId: "or1",
    customerId: "cust1",
    restaurantId: "r1",
    restaurantName: "Spice Hub",
    status: "REQUESTED",
    lines: [],
    pricing: {
      subtotal: { amount: 0, currency: "INR" },
      fees: [],
      discount: { amount: 0, currency: "INR" },
      tax: { amount: 0, currency: "INR" },
      total: { amount: 0, currency: "INR" },
    },
    deliveryAddress: {
      street: "12 MG Road",
      city: "Bengaluru",
      state: "KA",
      pinCode: "560001",
      coordinates: { lat: 12.97, lng: 77.59 },
    },
    paymentMethod: "UPI",
    idempotencyKey: "key-1",
    schemaVersion: 1,
    createdAt: "2026-06-22T00:00:00.000Z",
    ...overrides,
  };
}

describe("checkoutService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("preview", () => {
    it("POSTs /checkout/preview with the saved addressId and no Idempotency-Key header", async () => {
      vi.mocked(client.post).mockResolvedValue(makePreviewDto());

      await checkoutService.preview("addr-1");

      expect(client.post).toHaveBeenCalledWith("/checkout/preview", {
        body: { addressId: "addr-1" },
      });
    });

    it("adapts the returned preview", async () => {
      vi.mocked(client.post).mockResolvedValue(makePreviewDto({ serviceable: false }));

      const vm = await checkoutService.preview("addr-1");

      expect(vm.serviceable).toBe(false);
    });
  });

  describe("checkout", () => {
    it("POSTs /checkout with the body and a generated Idempotency-Key when none supplied", async () => {
      vi.mocked(client.post).mockResolvedValue(makeSummaryDto());

      const result = await checkoutService.checkout({
        paymentMethod: "UPI",
        addressId: "addr-1",
      });

      expect(client.post).toHaveBeenCalledWith("/checkout", {
        body: {
          paymentMethod: "UPI",
          addressId: "addr-1",
        },
        headers: { "Idempotency-Key": "generated-uuid" },
      });
      expect(result.idempotencyKeyUsed).toBe("generated-uuid");
    });

    it("uses a caller-supplied idempotency key instead of generating one", async () => {
      vi.mocked(client.post).mockResolvedValue(makeSummaryDto({ idempotencyKey: "caller-key" }));

      const result = await checkoutService.checkout({
        paymentMethod: "COD",
        addressId: "addr-1",
        idempotencyKey: "caller-key",
      });

      expect(client.post).toHaveBeenCalledWith(
        "/checkout",
        expect.objectContaining({ headers: { "Idempotency-Key": "caller-key" } }),
      );
      expect(result.idempotencyKeyUsed).toBe("caller-key");
    });

    it("adapts the returned order confirmation", async () => {
      vi.mocked(client.post).mockResolvedValue(makeSummaryDto({ restaurantName: "Spice Hub" }));

      const result = await checkoutService.checkout({
        paymentMethod: "CARD",
        addressId: "addr-1",
      });

      expect(result.order.restaurantName).toBe("Spice Hub");
      expect(result.order.status).toBe("REQUESTED");
    });
  });

  describe("observability on failure (Batch 12.4)", () => {
    function reporterSpy(): Reporter & {
      errors: unknown[];
      metrics: string[];
    } {
      const errors: unknown[] = [];
      const metrics: string[] = [];
      return {
        errors,
        metrics,
        captureError(error) {
          errors.push(error);
        },
        incrementMetric(name) {
          metrics.push(name);
        },
      };
    }

    afterEach(() => {
      resetReporter();
    });

    it("reports a failed preview and rethrows the ApiError", async () => {
      const spy = reporterSpy();
      setReporter(spy);
      const err = new ApiError({
        status: 422,
        code: "NOT_SERVICEABLE",
        message: "Out of range",
        requestId: "req-prev",
      });
      vi.mocked(client.post).mockRejectedValue(err);

      await expect(checkoutService.preview("addr-1")).rejects.toBe(err);

      expect(spy.errors).toContain(err);
      expect(spy.metrics).toContain("checkout.failure");
    });

    it("reports a failed place-order and rethrows the ApiError", async () => {
      const spy = reporterSpy();
      setReporter(spy);
      const err = new ApiError({
        status: 409,
        code: "CART_CHANGED",
        message: "Cart changed",
        requestId: "req-checkout",
      });
      vi.mocked(client.post).mockRejectedValue(err);

      await expect(
        checkoutService.checkout({
          paymentMethod: "UPI",
          addressId: "addr-1",
        }),
      ).rejects.toBe(err);

      expect(spy.errors).toContain(err);
      expect(spy.metrics).toContain("checkout.failure");
    });
  });

  describe("getOrderRequest", () => {
    it("GETs /order-requests/:id and adapts the result", async () => {
      vi.mocked(client.get).mockResolvedValue(makeSummaryDto());

      const vm = await checkoutService.getOrderRequest("or1");

      expect(client.get).toHaveBeenCalledWith("/order-requests/or1");
      expect(vm.orderRequestId).toBe("or1");
    });
  });
});
