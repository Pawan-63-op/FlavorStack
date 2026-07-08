import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FulfillmentAdminResponse } from "../adapters/fulfillmentAdmin";
import { client } from "../client/http";
import { fulfillmentOwnerService } from "./fulfillmentOwner";

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

function makeFulfillment(overrides: Partial<FulfillmentAdminResponse> = {}): FulfillmentAdminResponse {
  return {
    fulfillmentId: "ful1",
    orderRequestId: "ord1",
    customerId: "cust1",
    restaurantId: "rest1",
    status: "PREPARING",
    deliveryStatus: "UNASSIGNED",
    total: { amount: 1599, currency: "USD" },
    currentAssignment: null,
    cancellation: null,
    failureReason: null,
    createdAt: "2026-06-22T10:00:00.000Z",
    updatedAt: "2026-06-22T10:05:00.000Z",
    ...overrides,
  };
}

describe("fulfillmentOwnerService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("markPreparing", () => {
    it("POSTs to /fulfillments/:id/preparing with an empty body when no estimate, and adapts the result", async () => {
      vi.mocked(client.post).mockResolvedValue(makeFulfillment({ status: "PREPARING" }));

      const vm = await fulfillmentOwnerService.markPreparing("ful1");

      expect(client.post).toHaveBeenCalledWith("/fulfillments/ful1/preparing", { body: {} });
      expect(vm.fulfillmentId).toBe("ful1");
      expect(vm.status).toBe("PREPARING");
    });

    it("includes prepEstimateMinutes when provided", async () => {
      vi.mocked(client.post).mockResolvedValue(makeFulfillment());

      await fulfillmentOwnerService.markPreparing("ful1", 20);

      expect(client.post).toHaveBeenCalledWith("/fulfillments/ful1/preparing", {
        body: { prepEstimateMinutes: 20 },
      });
    });
  });

  describe("markReady", () => {
    it("POSTs to /fulfillments/:id/ready with an empty body and adapts the result", async () => {
      vi.mocked(client.post).mockResolvedValue(makeFulfillment({ status: "READY_FOR_PICKUP" }));

      const vm = await fulfillmentOwnerService.markReady("ful1");

      expect(client.post).toHaveBeenCalledWith("/fulfillments/ful1/ready", { body: {} });
      expect(vm.status).toBe("READY_FOR_PICKUP");
    });
  });
});
