import { describe, expect, it } from "vitest";
import { trackingAdapter, type TrackingResponse, type TrackingTimelineEntryResponse } from "./tracking";

function makeTimelineEntry(
  overrides: Partial<TrackingTimelineEntryResponse> = {},
): TrackingTimelineEntryResponse {
  return { status: "CREATED", at: "2026-06-22T10:00:00.000Z", ...overrides };
}

function makeTracking(overrides: Partial<TrackingResponse> = {}): TrackingResponse {
  return {
    fulfillmentId: "f1",
    orderRequestId: "or1",
    currentStatus: "PREPARING",
    deliveryStatus: "UNASSIGNED",
    riderId: null,
    timeline: [makeTimelineEntry()],
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

describe("trackingAdapter", () => {
  it("converts total from minor to major units", () => {
    const vm = trackingAdapter(makeTracking());
    expect(vm.total).toEqual({ amount: 659.98, currency: "INR" });
    expect(vm.formattedTotal).toContain("659.98");
  });

  it("attaches a human label to currentStatus and deliveryStatus", () => {
    const vm = trackingAdapter(makeTracking({ currentStatus: "OUT_FOR_DELIVERY", deliveryStatus: "EN_ROUTE_TO_CUSTOMER" }));
    expect(vm.currentStatusLabel).toBe("Out for delivery");
    expect(vm.deliveryStatusLabel).toBe("On the way to you");
  });

  it("normalizes the timeline, attaching a label per entry", () => {
    const vm = trackingAdapter(
      makeTracking({
        timeline: [
          makeTimelineEntry({ status: "CREATED", at: "2026-06-22T09:00:00.000Z" }),
          makeTimelineEntry({ status: "PREPARING", at: "2026-06-22T09:05:00.000Z", note: "started cooking" }),
        ],
      }),
    );
    expect(vm.timeline).toEqual([
      { status: "CREATED", statusLabel: "Order received", at: "2026-06-22T09:00:00.000Z" },
      { status: "PREPARING", statusLabel: "Preparing", at: "2026-06-22T09:05:00.000Z", note: "started cooking" },
    ]);
  });

  it("passes through ids, rider, address, cancellation, failureReason, updatedAt unchanged", () => {
    const vm = trackingAdapter(makeTracking({ riderId: "rider-9" }));
    expect(vm.fulfillmentId).toBe("f1");
    expect(vm.orderRequestId).toBe("or1");
    expect(vm.riderId).toBe("rider-9");
    expect(vm.deliveryAddress).toEqual({
      street: "12 MG Road",
      city: "Bengaluru",
      state: "KA",
      pinCode: "560001",
      coordinates: { lat: 12.97, lng: 77.59 },
    });
    expect(vm.cancellation).toBeNull();
    expect(vm.failureReason).toBeNull();
    expect(vm.updatedAt).toBe("2026-06-22T10:05:00.000Z");
  });

  it("marks isTerminal true for a terminal currentStatus", () => {
    expect(trackingAdapter(makeTracking({ currentStatus: "DELIVERED" })).isTerminal).toBe(true);
    expect(trackingAdapter(makeTracking({ currentStatus: "PREPARING" })).isTerminal).toBe(false);
  });

  it("passes through a populated cancellation block", () => {
    const vm = trackingAdapter(
      makeTracking({
        currentStatus: "CANCELLED",
        cancellation: { cancelledBy: "customer", reason: "changed mind", at: "2026-06-22T10:02:00.000Z" },
      }),
    );
    expect(vm.cancellation).toEqual({
      cancelledBy: "customer",
      reason: "changed mind",
      at: "2026-06-22T10:02:00.000Z",
    });
  });
});
