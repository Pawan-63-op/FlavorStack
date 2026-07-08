import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import {
  getNextFulfillmentOffset,
  invalidateFulfillmentAdminCaches,
} from "./useFulfillmentAdmin";
import type { AdminFulfillmentsPage } from "../services/fulfillmentAdmin";
import type { AdminDashboardItemView } from "../adapters/fulfillmentAdmin";
import { queryKeys } from "../queryKeys";

function makeView(overrides: Partial<AdminDashboardItemView> = {}): AdminDashboardItemView {
  return {
    fulfillmentId: "ful1",
    orderRequestId: "ord1",
    customerId: "cust1",
    restaurantId: "rest1",
    status: "PREPARING",
    statusLabel: "Preparing",
    deliveryStatus: "UNASSIGNED",
    deliveryStatusLabel: "Awaiting rider",
    riderId: null,
    createdAt: "2026-06-22T10:00:00.000Z",
    formattedAge: "2 hours ago",
    updatedAt: "2026-06-22T10:05:00.000Z",
    slaBreached: false,
    exceptionFlag: false,
    cancellation: null,
    failureReason: null,
    total: { amount: 15.99, currency: "USD" },
    formattedTotal: "$15.99",
    isCancellable: true,
    isReassignable: true,
    ...overrides,
  };
}

function makePage(items: AdminDashboardItemView[], hasMore: boolean): AdminFulfillmentsPage {
  return { items, hasMore };
}

describe("getNextFulfillmentOffset", () => {
  it("returns the next offset (pages * limit) while the last page has more", () => {
    const page = makePage([makeView()], true);
    expect(getNextFulfillmentOffset(page, [page], 20)).toBe(20);
    expect(getNextFulfillmentOffset(page, [page, page], 20)).toBe(40);
  });

  it("returns undefined (stop) once the last page reports no more", () => {
    const page = makePage([makeView()], false);
    expect(getNextFulfillmentOffset(page, [page], 20)).toBeUndefined();
  });
});

describe("invalidateFulfillmentAdminCaches", () => {
  it("invalidates every fulfillmentAdmin list query regardless of filter params", () => {
    const invalidateQueries = vi.fn();
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    invalidateFulfillmentAdminCaches(queryClient);

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["fulfillmentAdmin", "list"],
    });
  });
});

describe("restaurantQueue query key (useRestaurantFulfillments)", () => {
  it("keys by restaurantId and optional status — distinct per restaurant", () => {
    expect(queryKeys.fulfillmentAdmin.restaurantQueue("rest1")).toEqual([
      "fulfillmentAdmin",
      "restaurantQueue",
      "rest1",
      undefined,
    ]);
    expect(queryKeys.fulfillmentAdmin.restaurantQueue("rest1", "PREPARING")).toEqual([
      "fulfillmentAdmin",
      "restaurantQueue",
      "rest1",
      "PREPARING",
    ]);
    expect(queryKeys.fulfillmentAdmin.restaurantQueue("rest2")).not.toEqual(
      queryKeys.fulfillmentAdmin.restaurantQueue("rest1"),
    );
  });
});
