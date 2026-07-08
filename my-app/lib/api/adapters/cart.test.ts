import { describe, expect, it } from "vitest";
import {
  cartAdapter,
  cartSummaryAdapter,
  promotionAdapter,
  type CartItemResponse,
  type CartResponseDto,
  type CartSummaryResponse,
} from "./cart";

function makeCartItem(overrides: Partial<CartItemResponse> = {}): CartItemResponse {
  return {
    id: "ci1",
    menuItemId: "mi1",
    selectedOptionIds: [],
    quantity: 2,
    unitPriceSnapshot: { amount: 29999, currency: "INR" },
    lineTotal: { amount: 59998, currency: "INR" },
    ...overrides,
  };
}

function makeCart(overrides: Partial<CartResponseDto> = {}): CartResponseDto {
  return {
    id: "cart1",
    customerId: "cust1",
    restaurantId: "r1",
    items: [makeCartItem()],
    currency: "INR",
    appliedPromotion: null,
    version: 1,
    createdAt: "2026-06-22T00:00:00.000Z",
    updatedAt: "2026-06-22T00:00:00.000Z",
    ...overrides,
  };
}

describe("cartAdapter", () => {
  it("maps cart items, converting minor-unit money to major units", () => {
    const cart = cartAdapter(makeCart());

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({
      cartItemId: "ci1",
      menuItemId: "mi1",
      selectedOptionIds: [],
      quantity: 2,
      isAvailable: true,
    });
    expect(cart.items[0].unitPrice).toEqual({ amount: 299.99, currency: "INR" });
    expect(cart.items[0].lineTotal).toEqual({ amount: 599.98, currency: "INR" });
    expect(cart.items[0].formattedLineTotal).toBe("₹599.98");
  });

  it("keeps cartItemId (item.id) distinct from menuItemId", () => {
    const cart = cartAdapter(
      makeCart({ items: [makeCartItem({ id: "ci-distinct", menuItemId: "mi-distinct" })] }),
    );

    expect(cart.items[0].cartItemId).toBe("ci-distinct");
    expect(cart.items[0].menuItemId).toBe("mi-distinct");
  });

  it("pulls name/isAvailable from enrichment when present", () => {
    const cart = cartAdapter(
      makeCart({
        items: [
          makeCartItem({
            enrichment: { name: "Paneer Tikka", currentUnitPrice: { amount: 29999, currency: "INR" }, isAvailable: false },
          }),
        ],
      }),
    );

    expect(cart.items[0].name).toBe("Paneer Tikka");
    expect(cart.items[0].isAvailable).toBe(false);
  });

  it("falls back to null name and isAvailable=true when enrichment is missing", () => {
    const cart = cartAdapter(makeCart({ items: [makeCartItem({ enrichment: undefined })] }));

    expect(cart.items[0].name).toBeNull();
    expect(cart.items[0].isAvailable).toBe(true);
  });

  it("computes subtotal as the sum of line totals", () => {
    const cart = cartAdapter(
      makeCart({
        items: [
          makeCartItem({ id: "ci1", lineTotal: { amount: 59998, currency: "INR" } }),
          makeCartItem({ id: "ci2", lineTotal: { amount: 10000, currency: "INR" } }),
        ],
      }),
    );

    expect(cart.subtotal).toEqual({ amount: 699.98, currency: "INR" });
    expect(cart.total).toEqual({ amount: 699.98, currency: "INR" });
  });

  it("subtracts the applied promotion discount from subtotal to compute total", () => {
    const cart = cartAdapter(
      makeCart({
        appliedPromotion: {
          code: "SAVE10",
          kind: "PERCENTAGE",
          discount: { amount: 10000, currency: "INR" },
          sourceRef: "promo1",
        },
      }),
    );

    expect(cart.subtotal).toEqual({ amount: 599.98, currency: "INR" });
    expect(cart.total).toEqual({ amount: 499.98, currency: "INR" });
    expect(cart.appliedPromotion).toMatchObject({
      code: "SAVE10",
      kind: "PERCENTAGE",
      sourceRef: "promo1",
    });
    expect(cart.appliedPromotion?.discount).toEqual({ amount: 100, currency: "INR" });
  });

  it("maps an empty cart (no restaurant, no items)", () => {
    const cart = cartAdapter(makeCart({ restaurantId: null, currency: null, items: [] }));

    expect(cart.restaurantId).toBeNull();
    expect(cart.items).toEqual([]);
    expect(cart.subtotal).toEqual({ amount: 0, currency: null });
    expect(cart.total).toEqual({ amount: 0, currency: null });
    expect(cart.appliedPromotion).toBeNull();
  });

  it("surfaces server version for optimistic-concurrency awareness", () => {
    const cart = cartAdapter(makeCart({ version: 7 }));

    expect(cart.version).toBe(7);
  });
});

describe("promotionAdapter", () => {
  it("converts a minor-unit promotion response (e.g. a validate-preview) to major-unit Money", () => {
    const promo = promotionAdapter({
      code: "SAVE10",
      kind: "PERCENTAGE",
      discount: { amount: 1000, currency: "INR" },
      sourceRef: "promo1",
    });

    expect(promo).toMatchObject({ code: "SAVE10", kind: "PERCENTAGE", sourceRef: "promo1" });
    expect(promo.discount).toEqual({ amount: 10, currency: "INR" });
    expect(promo.formattedDiscount).toBe("₹10.00");
  });
});

describe("cartSummaryAdapter", () => {
  function makeSummary(overrides: Partial<CartSummaryResponse> = {}): CartSummaryResponse {
    return {
      cartId: "cart1",
      itemCount: 3,
      total: { amount: 59998, currency: "INR" },
      currency: "INR",
      ...overrides,
    };
  }

  it("maps a populated summary with major-unit money", () => {
    const summary = cartSummaryAdapter(makeSummary());

    expect(summary).toMatchObject({ cartId: "cart1", itemCount: 3, currency: "INR" });
    expect(summary.total).toEqual({ amount: 599.98, currency: "INR" });
    expect(summary.formattedTotal).toBe("₹599.98");
  });

  it("maps an empty-cart summary (null total/currency, zero count)", () => {
    const summary = cartSummaryAdapter(makeSummary({ total: null, currency: null, itemCount: 0 }));

    expect(summary.total).toBeNull();
    expect(summary.itemCount).toBe(0);
  });
});
