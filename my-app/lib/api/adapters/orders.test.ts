import { describe, expect, it } from "vitest";
import { customerOrderAdapter, type CustomerOrderResponse } from "./orders";

function makeDto(overrides: Partial<CustomerOrderResponse> = {}): CustomerOrderResponse {
  return {
    fulfillmentId: "f1",
    orderRequestId: "or1",
    restaurantId: "rest1",
    fulfillmentStatus: "PREPARING",
    deliveryStatus: "UNASSIGNED",
    total: { amount: 65998, currency: "INR" },
    placedAt: "2026-06-22T10:00:00.000Z",
    updatedAt: "2026-06-22T10:05:00.000Z",
    ...overrides,
  };
}

describe("customerOrderAdapter", () => {
  it("preserves the order↔fulfillment linkage ids", () => {
    const vm = customerOrderAdapter(makeDto());
    expect(vm.fulfillmentId).toBe("f1");
    expect(vm.orderRequestId).toBe("or1");
    expect(vm.restaurantId).toBe("rest1");
  });

  it("converts the total from minor to major units", () => {
    const vm = customerOrderAdapter(makeDto({ total: { amount: 65998, currency: "INR" } }));
    expect(vm.total).toEqual({ amount: 659.98, currency: "INR" });
  });

  it("derives human-readable status labels", () => {
    const vm = customerOrderAdapter(makeDto({ fulfillmentStatus: "PREPARING", deliveryStatus: "UNASSIGNED" }));
    expect(vm.fulfillmentStatusLabel).toBeTruthy();
    expect(vm.deliveryStatusLabel).toBeTruthy();
  });

  it("passes timestamps through untouched", () => {
    const vm = customerOrderAdapter(makeDto());
    expect(vm.placedAt).toBe("2026-06-22T10:00:00.000Z");
    expect(vm.updatedAt).toBe("2026-06-22T10:05:00.000Z");
  });
});
