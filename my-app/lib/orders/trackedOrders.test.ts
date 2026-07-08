import { beforeEach, describe, expect, it } from "vitest";
import {
  addTrackedOrder,
  getTrackedOrder,
  getTrackedOrders,
  setFulfillmentId,
  updateTrackedStatus,
  type TrackedOrder,
} from "./trackedOrders";

function makeOrder(overrides: Partial<TrackedOrder> = {}): TrackedOrder {
  return {
    orderRequestId: "ord-1",
    restaurantName: "Test Diner",
    total: { amount: 24.5, currency: "USD" },
    createdAt: "2026-06-22T12:00:00.000Z",
    idempotencyKey: "key-1",
    ...overrides,
  };
}

describe("trackedOrders", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns an empty list when nothing is stored", () => {
    expect(getTrackedOrders()).toEqual([]);
  });

  it("persists an order and reads it back", () => {
    const order = makeOrder();
    addTrackedOrder(order);
    expect(getTrackedOrders()).toEqual([order]);
    expect(JSON.parse(window.localStorage.getItem("tracked-orders")!)).toEqual([order]);
  });

  it("prepends newest first", () => {
    addTrackedOrder(makeOrder({ orderRequestId: "ord-1" }));
    addTrackedOrder(makeOrder({ orderRequestId: "ord-2" }));
    expect(getTrackedOrders().map((o) => o.orderRequestId)).toEqual(["ord-2", "ord-1"]);
  });

  it("de-duplicates by orderRequestId (idempotent replay) keeping the latest", () => {
    addTrackedOrder(makeOrder({ orderRequestId: "ord-1", idempotencyKey: "key-1" }));
    addTrackedOrder(makeOrder({ orderRequestId: "ord-1", idempotencyKey: "key-1" }));
    const all = getTrackedOrders();
    expect(all).toHaveLength(1);
    expect(all[0].orderRequestId).toBe("ord-1");
  });

  it("looks up a single order by id", () => {
    addTrackedOrder(makeOrder({ orderRequestId: "ord-7" }));
    expect(getTrackedOrder("ord-7")?.orderRequestId).toBe("ord-7");
    expect(getTrackedOrder("missing")).toBeUndefined();
  });

  it("recovers from corrupt storage by returning an empty list", () => {
    window.localStorage.setItem("tracked-orders", "not-json{");
    expect(getTrackedOrders()).toEqual([]);
  });

  describe("setFulfillmentId", () => {
    it("caches the discovered fulfillmentId on the matching tracked order", () => {
      addTrackedOrder(makeOrder({ orderRequestId: "ord-1" }));
      setFulfillmentId("ord-1", "fid-1");
      expect(getTrackedOrder("ord-1")?.fulfillmentId).toBe("fid-1");
    });

    it("is a no-op when the orderRequestId is not tracked", () => {
      addTrackedOrder(makeOrder({ orderRequestId: "ord-1" }));
      setFulfillmentId("missing", "fid-1");
      expect(getTrackedOrders()).toHaveLength(1);
      expect(getTrackedOrder("ord-1")?.fulfillmentId).toBeUndefined();
    });

    it("preserves newest-first ordering and the rest of the list", () => {
      addTrackedOrder(makeOrder({ orderRequestId: "ord-1" }));
      addTrackedOrder(makeOrder({ orderRequestId: "ord-2" }));
      setFulfillmentId("ord-1", "fid-1");
      expect(getTrackedOrders().map((o) => o.orderRequestId)).toEqual(["ord-2", "ord-1"]);
    });
  });

  describe("updateTrackedStatus", () => {
    it("caches the latest known status on the matching tracked order", () => {
      addTrackedOrder(makeOrder({ orderRequestId: "ord-1" }));
      updateTrackedStatus("ord-1", "OUT_FOR_DELIVERY");
      expect(getTrackedOrder("ord-1")?.lastKnownStatus).toBe("OUT_FOR_DELIVERY");
    });

    it("is a no-op when the orderRequestId is not tracked", () => {
      addTrackedOrder(makeOrder({ orderRequestId: "ord-1" }));
      updateTrackedStatus("missing", "DELIVERED");
      expect(getTrackedOrder("ord-1")?.lastKnownStatus).toBeUndefined();
    });
  });
});
