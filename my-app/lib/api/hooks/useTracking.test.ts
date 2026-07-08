import { beforeEach, describe, expect, it, vi } from "vitest";
import { isOrderCancellable, trackingRefetchInterval, syncTrackedOrderFromTracking } from "./useTracking";
import type { TrackingView } from "../adapters/tracking";
import { setFulfillmentId, updateTrackedStatus } from "../../orders/trackedOrders";

vi.mock("../../orders/trackedOrders", () => ({
  setFulfillmentId: vi.fn(),
  updateTrackedStatus: vi.fn(),
}));

function makeTrackingView(overrides: Partial<TrackingView> = {}): TrackingView {
  return {
    fulfillmentId: "f1",
    orderRequestId: "or1",
    currentStatus: "PREPARING",
    currentStatusLabel: "Preparing",
    deliveryStatus: "UNASSIGNED",
    deliveryStatusLabel: "Awaiting rider",
    riderId: null,
    timeline: [],
    deliveryAddress: {
      street: "12 MG Road",
      city: "Bengaluru",
      state: "KA",
      pinCode: "560001",
      coordinates: { lat: 12.97, lng: 77.59 },
    },
    total: { amount: 659.98, currency: "INR" },
    formattedTotal: "₹659.98",
    cancellation: null,
    failureReason: null,
    updatedAt: "2026-06-22T10:05:00.000Z",
    isTerminal: false,
    ...overrides,
  };
}

describe("trackingRefetchInterval", () => {
  it("polls when there is no data yet", () => {
    expect(trackingRefetchInterval(undefined)).toBe(10_000);
  });

  it("polls while the fulfillment is non-terminal", () => {
    expect(trackingRefetchInterval(makeTrackingView({ isTerminal: false }))).toBe(10_000);
  });

  it("stops polling once the fulfillment is terminal", () => {
    expect(trackingRefetchInterval(makeTrackingView({ isTerminal: true }))).toBe(false);
  });

  it("disables polling while the socket is connected (socket is authoritative)", () => {
    expect(trackingRefetchInterval(makeTrackingView({ isTerminal: false }), true)).toBe(false);
    expect(trackingRefetchInterval(undefined, true)).toBe(false);
  });
});

describe("isOrderCancellable", () => {
  it("allows cancel from pre-pickup statuses", () => {
    for (const status of ["CREATED", "PREPARING", "READY_FOR_PICKUP"]) {
      expect(isOrderCancellable(status)).toBe(true);
    }
  });

  it("rejects cancel once picked up / terminal", () => {
    for (const status of ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "FAILED"]) {
      expect(isOrderCancellable(status)).toBe(false);
    }
  });

  it("treats null/empty status as not cancellable", () => {
    expect(isOrderCancellable(null)).toBe(false);
    expect(isOrderCancellable(undefined)).toBe(false);
    expect(isOrderCancellable("")).toBe(false);
  });
});

describe("syncTrackedOrderFromTracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("caches the discovered fulfillmentId and latest status on the tracked order", () => {
    const view = makeTrackingView({ orderRequestId: "or1", fulfillmentId: "f1", currentStatus: "OUT_FOR_DELIVERY" });

    syncTrackedOrderFromTracking(view);

    expect(setFulfillmentId).toHaveBeenCalledWith("or1", "f1");
    expect(updateTrackedStatus).toHaveBeenCalledWith("or1", "OUT_FOR_DELIVERY");
  });
});
