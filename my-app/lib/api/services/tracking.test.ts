import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrackingResponse } from "../adapters/tracking";
import { client } from "../client/http";
import { trackingService } from "./tracking";

vi.mock("../client/http", () => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
    raw: vi.fn(),
  },
}));

function makeTrackingDto(overrides: Partial<TrackingResponse> = {}): TrackingResponse {
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

describe("trackingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTracking", () => {
    it("GETs /fulfillments/:id/tracking and adapts the result", async () => {
      vi.mocked(client.get).mockResolvedValue(makeTrackingDto());

      const vm = await trackingService.getTracking("f1");

      expect(client.get).toHaveBeenCalledWith("/fulfillments/f1/tracking");
      expect(vm.fulfillmentId).toBe("f1");
      expect(vm.total).toEqual({ amount: 659.98, currency: "INR" });
    });
  });

  describe("cancelOrder", () => {
    it("POSTs /fulfillments/:id/cancel with the required reason", async () => {
      vi.mocked(client.post).mockResolvedValue(undefined);

      await trackingService.cancelOrder("f1", "Changed my mind");

      expect(client.post).toHaveBeenCalledWith("/fulfillments/f1/cancel", {
        body: { reason: "Changed my mind" },
      });
    });
  });
});
