import { describe, expect, it } from "vitest";
import { applyStatusEvent, resolveTrackingView, terminalBannerFor } from "./OrderTracking";
import type { TrackingResponse, TrackingView } from "@/lib/api/adapters/tracking";
import {
  INITIAL_TRACKING_SOCKET_STATE,
  type TrackingSocketState,
} from "@/hooks_/useTrackingSocket";

function makeTrackingView(overrides: Partial<TrackingView> = {}): TrackingView {
  return {
    fulfillmentId: "f1",
    orderRequestId: "or1",
    currentStatus: "OUT_FOR_DELIVERY",
    currentStatusLabel: "Out for delivery",
    deliveryStatus: "EN_ROUTE_TO_CUSTOMER",
    deliveryStatusLabel: "On the way to you",
    riderId: "rider-1",
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

describe("terminalBannerFor", () => {
  it("returns null when the order is neither cancelled nor failed", () => {
    expect(terminalBannerFor(makeTrackingView())).toBeNull();
  });

  it("returns a cancellation banner when cancellation is present", () => {
    const view = makeTrackingView({
      cancellation: { cancelledBy: "CUSTOMER", reason: "Changed my mind", at: "2026-06-22T10:00:00.000Z" },
    });

    expect(terminalBannerFor(view)).toEqual({
      variant: "cancelled",
      message: "Cancelled by CUSTOMER: Changed my mind",
    });
  });

  it("returns a failure banner when failureReason is present", () => {
    const view = makeTrackingView({ failureReason: "Restaurant could not fulfill the order" });

    expect(terminalBannerFor(view)).toEqual({
      variant: "failed",
      message: "Restaurant could not fulfill the order",
    });
  });

  it("prefers the cancellation banner if both are somehow present", () => {
    const view = makeTrackingView({
      cancellation: { cancelledBy: "RESTAURANT", reason: "Out of stock", at: "2026-06-22T10:00:00.000Z" },
      failureReason: "Should not happen",
    });

    expect(terminalBannerFor(view)?.variant).toBe("cancelled");
  });
});

function makeSnapshot(overrides: Partial<TrackingResponse> = {}): TrackingResponse {
  return {
    fulfillmentId: "f1",
    orderRequestId: "or1",
    currentStatus: "PREPARING",
    deliveryStatus: "UNASSIGNED",
    riderId: null,
    timeline: [{ status: "CREATED", at: "2026-06-22T10:00:00.000Z" }],
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

function socketState(overrides: Partial<TrackingSocketState> = {}): TrackingSocketState {
  return { ...INITIAL_TRACKING_SOCKET_STATE, ...overrides };
}

describe("applyStatusEvent", () => {
  it("advances currentStatus + derived label/terminal flag and appends a timeline entry", () => {
    const base = makeTrackingView({ currentStatus: "PREPARING", timeline: [] });
    const next = applyStatusEvent(base, {
      fulfillmentId: "f1",
      status: "OUT_FOR_DELIVERY",
      at: "2026-06-22T10:10:00.000Z",
    });

    expect(next.currentStatus).toBe("OUT_FOR_DELIVERY");
    expect(next.currentStatusLabel).toBe("Out for delivery");
    expect(next.isTerminal).toBe(false);
    expect(next.timeline).toHaveLength(1);
    expect(next.timeline[0]).toMatchObject({ status: "OUT_FOR_DELIVERY", statusLabel: "Out for delivery" });
  });

  it("marks terminal when the live status is DELIVERED", () => {
    const next = applyStatusEvent(makeTrackingView(), {
      fulfillmentId: "f1",
      status: "DELIVERED",
      at: "2026-06-22T11:00:00.000Z",
    });
    expect(next.isTerminal).toBe(true);
  });

  it("does not duplicate a timeline entry already present at the same time", () => {
    const base = makeTrackingView({
      timeline: [{ status: "OUT_FOR_DELIVERY", statusLabel: "Out for delivery", at: "2026-06-22T10:10:00.000Z" }],
    });
    const next = applyStatusEvent(base, {
      fulfillmentId: "f1",
      status: "OUT_FOR_DELIVERY",
      at: "2026-06-22T10:10:00.000Z",
    });
    expect(next.timeline).toHaveLength(1);
  });
});

describe("resolveTrackingView", () => {
  it("returns null when neither HTTP nor the socket has data", () => {
    expect(resolveTrackingView(undefined, socketState())).toBeNull();
  });

  it("falls back to HTTP data when there is no snapshot", () => {
    const http = makeTrackingView({ currentStatus: "PREPARING" });
    expect(resolveTrackingView(http, socketState())).toBe(http);
  });

  it("prefers the live snapshot over HTTP data", () => {
    const http = makeTrackingView({ orderRequestId: "stale" });
    const resolved = resolveTrackingView(http, socketState({ snapshot: makeSnapshot({ orderRequestId: "fresh" }) }));
    expect(resolved?.orderRequestId).toBe("fresh");
  });

  it("folds a live status event on top of the resolved base", () => {
    const resolved = resolveTrackingView(
      makeTrackingView({ currentStatus: "PREPARING", timeline: [] }),
      socketState({ status: { fulfillmentId: "f1", status: "DELIVERED", at: "2026-06-22T11:00:00.000Z" } }),
    );
    expect(resolved?.currentStatus).toBe("DELIVERED");
    expect(resolved?.isTerminal).toBe(true);
  });
});
