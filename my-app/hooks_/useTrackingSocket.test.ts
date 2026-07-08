import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  INITIAL_TRACKING_SOCKET_STATE,
  syncTrackedOrderFromSnapshot,
  trackingSocketReducer,
  type TrackingSocketState,
} from "./useTrackingSocket";
import { setFulfillmentId, updateTrackedStatus } from "@/lib/orders/trackedOrders";
import type { TrackingResponse } from "@/lib/api/adapters/tracking";

vi.mock("@/lib/orders/trackedOrders", () => ({
  setFulfillmentId: vi.fn(),
  updateTrackedStatus: vi.fn(),
}));

function makeSnapshot(overrides: Partial<TrackingResponse> = {}): TrackingResponse {
  return {
    fulfillmentId: "f1",
    orderRequestId: "or1",
    currentStatus: "PREPARING",
    deliveryStatus: "UNASSIGNED",
    riderId: null,
    timeline: [],
    deliveryAddress: {
      street: "12 MG Road",
      city: "Bengaluru",
      state: "KA",
      pinCode: "560001",
      coordinates: { lat: 12.97, lng: 77.59 },
    },
    total: { amount: 65998, currency: "INR" },
    cancellation: null,
    failureReason: null,
    updatedAt: "2026-06-22T10:05:00.000Z",
    ...overrides,
  };
}

describe("trackingSocketReducer", () => {
  it("marks connected and clears any prior error", () => {
    const next = trackingSocketReducer(
      { ...INITIAL_TRACKING_SOCKET_STATE, error: "boom" },
      { type: "connected" },
    );
    expect(next.connected).toBe(true);
    expect(next.error).toBeNull();
  });

  it("marks disconnected without dropping the snapshot (HTTP fallback keeps it)", () => {
    const snapshot = makeSnapshot();
    const connected: TrackingSocketState = {
      ...INITIAL_TRACKING_SOCKET_STATE,
      connected: true,
      snapshot,
    };
    const next = trackingSocketReducer(connected, { type: "disconnected" });
    expect(next.connected).toBe(false);
    expect(next.snapshot).toBe(snapshot);
  });

  it("stores the subscribe snapshot", () => {
    const snapshot = makeSnapshot();
    const next = trackingSocketReducer(INITIAL_TRACKING_SOCKET_STATE, {
      type: "subscribed",
      snapshot,
    });
    expect(next.snapshot).toBe(snapshot);
  });

  it("records the latest status event", () => {
    const event = { fulfillmentId: "f1", status: "OUT_FOR_DELIVERY", at: "2026-06-22T10:10:00.000Z" };
    const next = trackingSocketReducer(INITIAL_TRACKING_SOCKET_STATE, { type: "status", event });
    expect(next.status).toEqual(event);
  });

  it("records the latest rider location", () => {
    const event = {
      fulfillmentId: "f1",
      riderId: "r1",
      lat: 12.98,
      lng: 77.6,
      recordedAt: "2026-06-22T10:11:00.000Z",
    };
    const next = trackingSocketReducer(INITIAL_TRACKING_SOCKET_STATE, { type: "location", event });
    expect(next.latestLocation).toEqual(event);
  });

  it("surfaces a tracking error message", () => {
    const next = trackingSocketReducer(INITIAL_TRACKING_SOCKET_STATE, {
      type: "error",
      message: "Access denied",
    });
    expect(next.error).toBe("Access denied");
  });

  it("reset returns the initial state", () => {
    const dirty: TrackingSocketState = {
      connected: true,
      snapshot: makeSnapshot(),
      status: { fulfillmentId: "f1", status: "DELIVERED", at: "x" },
      latestLocation: null,
      error: "x",
    };
    expect(trackingSocketReducer(dirty, { type: "reset" })).toEqual(INITIAL_TRACKING_SOCKET_STATE);
  });
});

describe("syncTrackedOrderFromSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("caches the snapshot's fulfillmentId and current status onto the tracked order", () => {
    syncTrackedOrderFromSnapshot(
      makeSnapshot({ orderRequestId: "or9", fulfillmentId: "f9", currentStatus: "OUT_FOR_DELIVERY" }),
    );
    expect(setFulfillmentId).toHaveBeenCalledWith("or9", "f9");
    expect(updateTrackedStatus).toHaveBeenCalledWith("or9", "OUT_FOR_DELIVERY");
  });
});
