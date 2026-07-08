import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomerOrderResponse } from "../adapters/orders";
import { client } from "../client/http";
import { ordersService } from "./orders";

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

function makeOrderDto(overrides: Partial<CustomerOrderResponse> = {}): CustomerOrderResponse {
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

describe("ordersService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listMyOrders", () => {
    it("GETs /me/orders and adapts each row (minor → major money)", async () => {
      vi.mocked(client.get).mockResolvedValue([makeOrderDto()]);

      const vms = await ordersService.listMyOrders();

      expect(client.get).toHaveBeenCalledWith("/me/orders");
      expect(vms).toHaveLength(1);
      expect(vms[0].fulfillmentId).toBe("f1");
      expect(vms[0].orderRequestId).toBe("or1");
      expect(vms[0].total).toEqual({ amount: 659.98, currency: "INR" });
    });

    it("returns an empty list when the customer has no orders", async () => {
      vi.mocked(client.get).mockResolvedValue([]);

      const vms = await ordersService.listMyOrders();

      expect(vms).toEqual([]);
    });
  });
});
