import { describe, expect, it } from "vitest";
import {
  checkoutPreviewAdapter,
  orderConfirmationAdapter,
  type CheckoutPreviewResponseDto,
  type FeeResponse,
  type OrderLineResponse,
  type OrderRequestLineResponse,
  type OrderRequestSummaryDto,
  type PricingResponse,
} from "./checkout";

function makeLine(overrides: Partial<OrderLineResponse> = {}): OrderLineResponse {
  return {
    menuItemId: "mi1",
    name: "Paneer Tikka",
    quantity: 2,
    unitPrice: { amount: 29999, currency: "INR" },
    lineTotal: { amount: 59998, currency: "INR" },
    ...overrides,
  };
}

/** Order-request line — no `unitPrice` (matches `OrderRequestSummaryResponse`). */
function makeOrderLine(
  overrides: Partial<OrderRequestLineResponse> = {},
): OrderRequestLineResponse {
  return {
    menuItemId: "mi1",
    name: "Paneer Tikka",
    quantity: 2,
    selectedOptions: [],
    lineTotal: { amount: 59998, currency: "INR" },
    ...overrides,
  };
}

function makeFee(overrides: Partial<FeeResponse> = {}): FeeResponse {
  return { type: "DELIVERY", amount: { amount: 5000, currency: "INR" }, ...overrides };
}

function makePricing(overrides: Partial<PricingResponse> = {}): PricingResponse {
  return {
    subtotal: { amount: 59998, currency: "INR" },
    fees: [makeFee()],
    discount: { amount: 1000, currency: "INR" },
    tax: { amount: 2000, currency: "INR" },
    total: { amount: 65998, currency: "INR" },
    ...overrides,
  };
}

function makePreview(overrides: Partial<CheckoutPreviewResponseDto> = {}): CheckoutPreviewResponseDto {
  return {
    restaurantId: "r1",
    lines: [makeLine()],
    pricing: makePricing(),
    serviceable: true,
    distanceMeters: 1200,
    deliveryFee: { amount: 5000, currency: "INR" },
    minOrder: { amount: 10000, currency: "INR" },
    promotion: null,
    ...overrides,
  };
}

describe("checkoutPreviewAdapter", () => {
  it("converts all money fields from minor to major units", () => {
    const vm = checkoutPreviewAdapter(makePreview());

    expect(vm.lines[0].unitPrice).toEqual({ amount: 299.99, currency: "INR" });
    expect(vm.lines[0].lineTotal).toEqual({ amount: 599.98, currency: "INR" });
    expect(vm.pricing.subtotal).toEqual({ amount: 599.98, currency: "INR" });
    expect(vm.pricing.discount).toEqual({ amount: 10, currency: "INR" });
    expect(vm.pricing.tax).toEqual({ amount: 20, currency: "INR" });
    expect(vm.pricing.total).toEqual({ amount: 659.98, currency: "INR" });
    expect(vm.deliveryFee).toEqual({ amount: 50, currency: "INR" });
    expect(vm.minOrder).toEqual({ amount: 100, currency: "INR" });
  });

  it("maps fees by type, preserving each fee's converted amount", () => {
    const vm = checkoutPreviewAdapter(
      makePreview({
        pricing: makePricing({
          fees: [
            makeFee({ type: "PLATFORM", amount: { amount: 500, currency: "INR" } }),
            makeFee({ type: "PACKAGING", amount: { amount: 1500, currency: "INR" } }),
          ],
        }),
      }),
    );

    expect(vm.pricing.fees).toEqual([
      expect.objectContaining({ type: "PLATFORM", amount: { amount: 5, currency: "INR" } }),
      expect.objectContaining({ type: "PACKAGING", amount: { amount: 15, currency: "INR" } }),
    ]);
  });

  it("passes through serviceable, distanceMeters, and null promotion", () => {
    const vm = checkoutPreviewAdapter(makePreview({ serviceable: false, distanceMeters: 9999 }));

    expect(vm.serviceable).toBe(false);
    expect(vm.distanceMeters).toBe(9999);
    expect(vm.promotion).toBeNull();
  });

  it("converts an applied promotion's discount to major units", () => {
    const vm = checkoutPreviewAdapter(
      makePreview({
        promotion: { code: "SAVE10", kind: "PERCENTAGE", discount: { amount: 1000, currency: "INR" }, sourceRef: "p1" },
      }),
    );

    expect(vm.promotion).toMatchObject({ code: "SAVE10", kind: "PERCENTAGE", sourceRef: "p1" });
    expect(vm.promotion?.discount).toEqual({ amount: 10, currency: "INR" });
  });
});

describe("orderConfirmationAdapter", () => {
  function makeSummary(overrides: Partial<OrderRequestSummaryDto> = {}): OrderRequestSummaryDto {
    return {
      orderRequestId: "or1",
      customerId: "cust1",
      restaurantId: "r1",
      restaurantName: "Spice Hub",
      status: "REQUESTED",
      lines: [makeOrderLine()],
      pricing: makePricing(),
      deliveryAddress: {
        street: "12 MG Road",
        city: "Bengaluru",
        state: "KA",
        pinCode: "560001",
        coordinates: { lat: 12.97, lng: 77.59 },
      },
      paymentMethod: "UPI",
      idempotencyKey: "00000000-0000-0000-0000-000000000000",
      schemaVersion: 1,
      createdAt: "2026-06-22T00:00:00.000Z",
      ...overrides,
    };
  }

  it("maps lines/pricing the same way as the preview adapter", () => {
    const vm = orderConfirmationAdapter(makeSummary());

    expect(vm.lines[0].lineTotal).toEqual({ amount: 599.98, currency: "INR" });
    expect(vm.pricing.total).toEqual({ amount: 659.98, currency: "INR" });
  });

  it("passes through identity, status, address, payment, and idempotency fields unchanged", () => {
    const vm = orderConfirmationAdapter(makeSummary());

    expect(vm).toMatchObject({
      orderRequestId: "or1",
      customerId: "cust1",
      restaurantId: "r1",
      restaurantName: "Spice Hub",
      status: "REQUESTED",
      paymentMethod: "UPI",
      idempotencyKey: "00000000-0000-0000-0000-000000000000",
      schemaVersion: 1,
      createdAt: "2026-06-22T00:00:00.000Z",
    });
    expect(vm.deliveryAddress).toEqual({
      street: "12 MG Road",
      city: "Bengaluru",
      state: "KA",
      pinCode: "560001",
      coordinates: { lat: 12.97, lng: 77.59 },
    });
  });
});
