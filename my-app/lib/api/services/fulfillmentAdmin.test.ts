import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AdminDashboardItemResponse,
  FulfillmentAdminResponse,
} from "../adapters/fulfillmentAdmin";
import { client } from "../client/http";
import { fulfillmentAdminService } from "./fulfillmentAdmin";

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

function makeItem(overrides: Partial<AdminDashboardItemResponse> = {}): AdminDashboardItemResponse {
  return {
    fulfillmentId: "ful1",
    orderRequestId: "ord1",
    customerId: "cust1",
    restaurantId: "rest1",
    status: "PREPARING",
    deliveryStatus: "UNASSIGNED",
    riderId: null,
    createdAt: "2026-06-22T10:00:00.000Z",
    updatedAt: "2026-06-22T10:05:00.000Z",
    slaBreached: false,
    exceptionFlag: false,
    cancellation: null,
    failureReason: null,
    total: { amount: 1599, currency: "USD" },
    ...overrides,
  };
}

function makeFulfillment(overrides: Partial<FulfillmentAdminResponse> = {}): FulfillmentAdminResponse {
  return {
    fulfillmentId: "ful1",
    orderRequestId: "ord1",
    customerId: "cust1",
    restaurantId: "rest1",
    status: "PREPARING",
    deliveryStatus: "ASSIGNED",
    total: { amount: 1599, currency: "USD" },
    currentAssignment: { riderId: "rider1", status: "ASSIGNED", attempt: 1, expiresAt: "2026-06-22T10:10:00.000Z" },
    cancellation: null,
    failureReason: null,
    createdAt: "2026-06-22T10:00:00.000Z",
    updatedAt: "2026-06-22T10:05:00.000Z",
    ...overrides,
  };
}

describe("fulfillmentAdminService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listAdminFulfillments", () => {
    it("GETs /admin/fulfillments with default limit/offset and no filters, and adapts each item", async () => {
      vi.mocked(client.get).mockResolvedValue([makeItem()]);

      const page = await fulfillmentAdminService.listAdminFulfillments();

      expect(client.get).toHaveBeenCalledWith("/admin/fulfillments?limit=20&offset=0");
      expect(page.items).toHaveLength(1);
      expect(page.items[0].fulfillmentId).toBe("ful1");
      expect(page.items[0].formattedTotal).toBe("$15.99");
    });

    it("includes status/restaurantId and slaBreached as 'true'/'false' strings", async () => {
      vi.mocked(client.get).mockResolvedValue([]);

      await fulfillmentAdminService.listAdminFulfillments({
        status: "PREPARING",
        slaBreached: true,
        restaurantId: "rest1",
      });

      expect(client.get).toHaveBeenCalledWith(
        "/admin/fulfillments?limit=20&offset=0&status=PREPARING&slaBreached=true&restaurantId=rest1",
      );
    });

    it("sends slaBreached=false when explicitly false (not omitted)", async () => {
      vi.mocked(client.get).mockResolvedValue([]);

      await fulfillmentAdminService.listAdminFulfillments({ slaBreached: false });

      expect(client.get).toHaveBeenCalledWith("/admin/fulfillments?limit=20&offset=0&slaBreached=false");
    });

    it("passes through explicit limit/offset", async () => {
      vi.mocked(client.get).mockResolvedValue([]);

      await fulfillmentAdminService.listAdminFulfillments({ limit: 5, offset: 10 });

      expect(client.get).toHaveBeenCalledWith("/admin/fulfillments?limit=5&offset=10");
    });

    it("reports hasMore=true at a full-page boundary", async () => {
      vi.mocked(client.get).mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => makeItem({ fulfillmentId: `f${i}` })),
      );

      const page = await fulfillmentAdminService.listAdminFulfillments({ limit: 5 });

      expect(page.hasMore).toBe(true);
    });

    it("reports hasMore=false when a page returns fewer than limit", async () => {
      vi.mocked(client.get).mockResolvedValue([makeItem()]);

      const page = await fulfillmentAdminService.listAdminFulfillments({ limit: 5 });

      expect(page.hasMore).toBe(false);
    });
  });

  describe("reassignFulfillment", () => {
    it("POSTs to /admin/fulfillments/:id/reassign and omits riderId when blank", async () => {
      vi.mocked(client.post).mockResolvedValue(makeFulfillment());

      const vm = await fulfillmentAdminService.reassignFulfillment("ful1");

      expect(client.post).toHaveBeenCalledWith("/admin/fulfillments/ful1/reassign", { body: {} });
      expect(vm.fulfillmentId).toBe("ful1");
    });

    it("includes riderId when provided", async () => {
      vi.mocked(client.post).mockResolvedValue(makeFulfillment());

      await fulfillmentAdminService.reassignFulfillment("ful1", "rider9");

      expect(client.post).toHaveBeenCalledWith("/admin/fulfillments/ful1/reassign", {
        body: { riderId: "rider9" },
      });
    });
  });

  describe("cancelFulfillment", () => {
    it("POSTs to /admin/fulfillments/:id/cancel always sending the reason", async () => {
      vi.mocked(client.post).mockResolvedValue(makeFulfillment({ status: "CANCELLED" }));

      const vm = await fulfillmentAdminService.cancelFulfillment("ful1", "kitchen closed");

      expect(client.post).toHaveBeenCalledWith("/admin/fulfillments/ful1/cancel", {
        body: { reason: "kitchen closed" },
      });
      expect(vm.status).toBe("CANCELLED");
    });
  });

  describe("listRestaurantFulfillments", () => {
    it("GETs /restaurants/:id/fulfillments with no query when status is omitted, and adapts each item", async () => {
      vi.mocked(client.get).mockResolvedValue([makeFulfillment()]);

      const items = await fulfillmentAdminService.listRestaurantFulfillments("rest1");

      expect(client.get).toHaveBeenCalledWith("/restaurants/rest1/fulfillments");
      expect(items).toHaveLength(1);
      expect(items[0].fulfillmentId).toBe("ful1");
      expect(items[0].formattedTotal).toBe("$15.99");
    });

    it("appends only a status query param when provided (no limit/offset)", async () => {
      vi.mocked(client.get).mockResolvedValue([]);

      await fulfillmentAdminService.listRestaurantFulfillments("rest1", "PREPARING");

      expect(client.get).toHaveBeenCalledWith("/restaurants/rest1/fulfillments?status=PREPARING");
    });
  });
});
