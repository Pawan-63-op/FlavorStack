import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CartResponseDto, ValidatePromotionResponseDto } from "../adapters/cart";
import { client } from "../client/http";
import { cartService } from "./cart";

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

function makeCartDto(overrides: Partial<CartResponseDto> = {}): CartResponseDto {
  return {
    id: "cart1",
    customerId: "cust1",
    restaurantId: "r1",
    items: [],
    currency: "INR",
    appliedPromotion: null,
    version: 1,
    createdAt: "2026-06-22T00:00:00.000Z",
    updatedAt: "2026-06-22T00:00:00.000Z",
    ...overrides,
  };
}

describe("cartService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCart", () => {
    it("GETs /cart and adapts the result", async () => {
      vi.mocked(client.get).mockResolvedValue(makeCartDto());

      const cart = await cartService.getCart();

      expect(client.get).toHaveBeenCalledWith("/cart");
      expect(cart.id).toBe("cart1");
    });
  });

  describe("getSummary", () => {
    it("GETs /cart/summary and adapts the result", async () => {
      vi.mocked(client.get).mockResolvedValue({
        cartId: "cart1",
        itemCount: 2,
        total: { amount: 1000, currency: "INR" },
        currency: "INR",
      });

      const summary = await cartService.getSummary();

      expect(client.get).toHaveBeenCalledWith("/cart/summary");
      expect(summary.itemCount).toBe(2);
    });
  });

  describe("addItem", () => {
    it("POSTs /cart/items with restaurantId + menuItemId + unitPrice (minor units)", async () => {
      vi.mocked(client.post).mockResolvedValue(makeCartDto());

      await cartService.addItem({
        restaurantId: "r1",
        menuItemId: "mi1",
        selectedOptionIds: ["opt1"],
        quantity: 2,
        unitPrice: { amount: 29999, currency: "INR" },
      });

      expect(client.post).toHaveBeenCalledWith("/cart/items", {
        body: {
          restaurantId: "r1",
          menuItemId: "mi1",
          selectedOptionIds: ["opt1"],
          quantity: 2,
          unitPrice: { amount: 29999, currency: "INR" },
        },
      });
    });

    it("adapts the returned cart", async () => {
      vi.mocked(client.post).mockResolvedValue(makeCartDto({ version: 2 }));

      const cart = await cartService.addItem({
        restaurantId: "r1",
        menuItemId: "mi1",
        quantity: 1,
        unitPrice: { amount: 1000 },
      });

      expect(cart.version).toBe(2);
    });
  });

  describe("updateItem", () => {
    it("PATCHes /cart/items/:itemId with quantity", async () => {
      vi.mocked(client.patch).mockResolvedValue(makeCartDto());

      await cartService.updateItem("ci1", 3);

      expect(client.patch).toHaveBeenCalledWith("/cart/items/ci1", { body: { quantity: 3 } });
    });

    it("accepts quantity=0 to signal removal", async () => {
      vi.mocked(client.patch).mockResolvedValue(makeCartDto());

      await cartService.updateItem("ci1", 0);

      expect(client.patch).toHaveBeenCalledWith("/cart/items/ci1", { body: { quantity: 0 } });
    });
  });

  describe("removeItem", () => {
    it("DELETEs /cart/items/:itemId and adapts the returned cart", async () => {
      vi.mocked(client.del).mockResolvedValue(makeCartDto());

      const cart = await cartService.removeItem("ci1");

      expect(client.del).toHaveBeenCalledWith("/cart/items/ci1");
      expect(cart.id).toBe("cart1");
    });
  });

  describe("clearCart", () => {
    it("DELETEs /cart and adapts the returned (empty) cart", async () => {
      vi.mocked(client.del).mockResolvedValue(makeCartDto({ items: [], restaurantId: null }));

      const cart = await cartService.clearCart();

      expect(client.del).toHaveBeenCalledWith("/cart");
      expect(cart.restaurantId).toBeNull();
    });
  });

  describe("applyPromotion", () => {
    it("POSTs /cart/promotion with the code and adapts the returned cart", async () => {
      vi.mocked(client.post).mockResolvedValue(
        makeCartDto({
          appliedPromotion: { code: "SAVE10", kind: "PERCENTAGE", discount: { amount: 1000, currency: "INR" }, sourceRef: "p1" },
        }),
      );

      const cart = await cartService.applyPromotion("SAVE10");

      expect(client.post).toHaveBeenCalledWith("/cart/promotion", { body: { code: "SAVE10" } });
      expect(cart.appliedPromotion?.code).toBe("SAVE10");
    });
  });

  describe("validatePromotion", () => {
    it("POSTs /cart/promotion/validate and returns the raw dry-run response", async () => {
      const response: ValidatePromotionResponseDto = {
        applicable: true,
        promotion: { code: "SAVE10", kind: "PERCENTAGE", discount: { amount: 1000, currency: "INR" }, sourceRef: "p1" },
      };
      vi.mocked(client.post).mockResolvedValue(response);

      const result = await cartService.validatePromotion("SAVE10");

      expect(client.post).toHaveBeenCalledWith("/cart/promotion/validate", { body: { code: "SAVE10" } });
      expect(result).toEqual(response);
    });
  });

  describe("removePromotion", () => {
    it("DELETEs /cart/promotion and adapts the returned cart", async () => {
      vi.mocked(client.del).mockResolvedValue(makeCartDto({ appliedPromotion: null }));

      const cart = await cartService.removePromotion();

      expect(client.del).toHaveBeenCalledWith("/cart/promotion");
      expect(cart.appliedPromotion).toBeNull();
    });
  });
});
