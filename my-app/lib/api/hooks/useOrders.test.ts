import { describe, expect, it } from "vitest";
import { mergeTrackedOrderResults, mergeServerAndCache } from "./useOrders";
import type { OrderConfirmationVM } from "../adapters/checkout";
import type { CustomerOrderVM } from "../adapters/orders";
import type { TrackedOrder } from "../../orders/trackedOrders";

function makeServerOrder(overrides: Partial<CustomerOrderVM> = {}): CustomerOrderVM {
  return {
    fulfillmentId: "f-1",
    orderRequestId: "ord-1",
    restaurantId: "r1",
    fulfillmentStatus: "PREPARING",
    fulfillmentStatusLabel: "Preparing",
    deliveryStatus: "UNASSIGNED",
    deliveryStatusLabel: "Awaiting rider",
    total: { amount: 24.5, currency: "USD" },
    placedAt: "2026-06-22T12:00:00.000Z",
    updatedAt: "2026-06-22T12:05:00.000Z",
    ...overrides,
  };
}

function makeTracked(overrides: Partial<TrackedOrder> = {}): TrackedOrder {
  return {
    orderRequestId: "ord-1",
    restaurantName: "Test Diner",
    total: { amount: 24.5, currency: "USD" },
    createdAt: "2026-06-22T12:00:00.000Z",
    idempotencyKey: "key-1",
    ...overrides,
  };
}

function makeOrder(overrides: Partial<OrderConfirmationVM> = {}): OrderConfirmationVM {
  return {
    orderRequestId: "ord-1",
    customerId: "cust-1",
    restaurantId: "r1",
    restaurantName: "Test Diner",
    status: "REQUESTED",
    lines: [],
    pricing: {
      subtotal: { amount: 24.5, currency: "USD" },
      formattedSubtotal: "$24.50",
      fees: [],
      discount: { amount: 0, currency: "USD" },
      formattedDiscount: "$0.00",
      tax: { amount: 0, currency: "USD" },
      formattedTax: "$0.00",
      total: { amount: 24.5, currency: "USD" },
      formattedTotal: "$24.50",
    },
    deliveryAddress: {
      street: "1 Main St",
      city: "Town",
      state: "ST",
      pinCode: "00000",
      coordinates: { lat: 0, lng: 0 },
    },
    paymentMethod: "CARD",
    idempotencyKey: "key-1",
    schemaVersion: 1,
    createdAt: "2026-06-22T12:00:00.000Z",
    ...overrides,
  };
}

describe("mergeTrackedOrderResults", () => {
  it("returns an empty list for no tracked orders", () => {
    expect(mergeTrackedOrderResults([], [])).toEqual([]);
  });

  it("attaches each query result to its matching tracked order, in order", () => {
    const tracked = [
      makeTracked({ orderRequestId: "ord-1" }),
      makeTracked({ orderRequestId: "ord-2" }),
    ];
    const order2 = makeOrder({ orderRequestId: "ord-2" });
    const results = [
      { data: undefined, isLoading: true, isError: false },
      { data: order2, isLoading: false, isError: false },
    ];

    const items = mergeTrackedOrderResults(tracked, results);

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      tracked: tracked[0],
      order: undefined,
      isLoading: true,
      isError: false,
    });
    expect(items[1]).toEqual({
      tracked: tracked[1],
      order: order2,
      isLoading: false,
      isError: false,
    });
  });

  it("degrades a failed id to its tracked fallback instead of dropping it", () => {
    const tracked = [makeTracked({ orderRequestId: "ord-1" })];
    const results = [{ data: undefined, isLoading: false, isError: true }];

    const items = mergeTrackedOrderResults(tracked, results);

    expect(items).toHaveLength(1);
    expect(items[0].order).toBeUndefined();
    expect(items[0].isError).toBe(true);
    expect(items[0].tracked.restaurantName).toBe("Test Diner");
  });

  it("treats a missing result (length mismatch) as not loading/not errored", () => {
    const tracked = [makeTracked({ orderRequestId: "ord-1" })];
    const items = mergeTrackedOrderResults(tracked, []);

    expect(items[0]).toEqual({
      tracked: tracked[0],
      order: undefined,
      isLoading: false,
      isError: false,
    });
  });
});

describe("mergeServerAndCache", () => {
  it("falls back to the cache when the server list is unavailable (undefined)", () => {
    const cached = [makeTracked({ orderRequestId: "ord-1" })];
    expect(mergeServerAndCache(undefined, cached)).toEqual(cached);
  });

  it("builds rows from server truth, taking status/total/fulfillmentId from the server", () => {
    const server = [makeServerOrder({ orderRequestId: "ord-1", fulfillmentId: "f-9", fulfillmentStatus: "DELIVERED", total: { amount: 99, currency: "USD" } })];
    const [row] = mergeServerAndCache(server, []);
    expect(row.fulfillmentId).toBe("f-9");
    expect(row.lastKnownStatus).toBe("DELIVERED");
    expect(row.total).toEqual({ amount: 99, currency: "USD" });
    expect(row.createdAt).toBe("2026-06-22T12:00:00.000Z");
  });

  it("supplies restaurantName from the cache (the server projection lacks it)", () => {
    const server = [makeServerOrder({ orderRequestId: "ord-1" })];
    const cached = [makeTracked({ orderRequestId: "ord-1", restaurantName: "Demo Diner" })];
    expect(mergeServerAndCache(server, cached)[0].restaurantName).toBe("Demo Diner");
  });

  it("defaults restaurantName when the order isn't in the cache (cross-device / fresh browser)", () => {
    const server = [makeServerOrder({ orderRequestId: "ord-1" })];
    expect(mergeServerAndCache(server, [])[0].restaurantName).toBe("Restaurant");
  });

  it("appends a cache-only order not yet on the server (just-placed, not yet projected)", () => {
    const server = [makeServerOrder({ orderRequestId: "ord-1" })];
    const cached = [makeTracked({ orderRequestId: "ord-2", restaurantName: "Pending Diner" })];
    const merged = mergeServerAndCache(server, cached);
    expect(merged.map((o) => o.orderRequestId)).toEqual(["ord-1", "ord-2"]);
  });

  it("does not duplicate an order present in both server and cache", () => {
    const server = [makeServerOrder({ orderRequestId: "ord-1" })];
    const cached = [makeTracked({ orderRequestId: "ord-1" })];
    expect(mergeServerAndCache(server, cached)).toHaveLength(1);
  });
});
