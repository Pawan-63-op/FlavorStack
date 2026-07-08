import { describe, expect, it } from "vitest";
import { pickFulfillmentId } from "./useMyOrders";
import type { CustomerOrderVM } from "../adapters/orders";

function makeOrder(overrides: Partial<CustomerOrderVM> = {}): CustomerOrderVM {
  return {
    fulfillmentId: "f1",
    orderRequestId: "or1",
    restaurantId: "rest1",
    fulfillmentStatus: "PREPARING",
    fulfillmentStatusLabel: "Preparing",
    deliveryStatus: "UNASSIGNED",
    deliveryStatusLabel: "Awaiting rider",
    total: { amount: 659.98, currency: "INR" },
    placedAt: "2026-06-22T10:00:00.000Z",
    updatedAt: "2026-06-22T10:05:00.000Z",
    ...overrides,
  };
}

describe("pickFulfillmentId", () => {
  it("returns the fulfillmentId of the matching order", () => {
    const orders = [makeOrder({ orderRequestId: "or1", fulfillmentId: "f1" }), makeOrder({ orderRequestId: "or2", fulfillmentId: "f2" })];
    expect(pickFulfillmentId(orders, "or2")).toBe("f2");
  });

  it("returns null when no order matches the id", () => {
    expect(pickFulfillmentId([makeOrder({ orderRequestId: "or1" })], "missing")).toBeNull();
  });

  it("returns null when there is no order list yet", () => {
    expect(pickFulfillmentId(undefined, "or1")).toBeNull();
  });

  it("returns null when no orderRequestId is provided", () => {
    expect(pickFulfillmentId([makeOrder()], null)).toBeNull();
  });
});
