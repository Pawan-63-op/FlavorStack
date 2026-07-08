import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FulfillmentAdminResponse } from "../adapters/fulfillmentAdmin";
import type { RiderQueueItemResponse } from "../adapters/driver";
import { client } from "../client/http";
import { driverService } from "./driver";

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

function makeFulfillment(
  overrides: Partial<FulfillmentAdminResponse> = {},
): FulfillmentAdminResponse {
  return {
    fulfillmentId: "ful1",
    orderRequestId: "ord1",
    customerId: "cust1",
    restaurantId: "rest1",
    status: "PICKED_UP",
    deliveryStatus: "PICKED_UP",
    total: { amount: 1599, currency: "USD" },
    currentAssignment: null,
    cancellation: null,
    failureReason: null,
    createdAt: "2026-06-26T10:00:00.000Z",
    updatedAt: "2026-06-26T10:05:00.000Z",
    ...overrides,
  };
}

function makeQueueDto(): RiderQueueItemResponse {
  return {
    fulfillmentId: "ful1",
    assignmentStatus: "OFFERED",
    attempt: 1,
    expiresAt: null,
    restaurantId: "rest1",
    deliveryAddress: {
      street: "12 Baker St",
      city: "London",
      state: "LDN",
      pinCode: "NW16XE",
      coordinates: { lat: 0, lng: 0 },
    },
    total: { amount: 1599, currency: "USD" },
    fulfillmentStatus: "READY_FOR_PICKUP",
    offeredAt: "2026-06-26T10:00:00.000Z",
    updatedAt: "2026-06-26T10:01:00.000Z",
  };
}

describe("driverService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("setAvailability PATCHes /users/me/availability with the boolean", async () => {
    vi.mocked(client.patch).mockResolvedValue({
      driverStatus: "ACTIVE",
      isAvailable: true,
      isOnline: true,
    });

    const res = await driverService.setAvailability(true);

    expect(client.patch).toHaveBeenCalledWith("/users/me/availability", {
      body: { available: true },
    });
    expect(res.isOnline).toBe(true);
  });

  it("getQueue GETs /riders/me/queue and adapts each item", async () => {
    vi.mocked(client.get).mockResolvedValue([makeQueueDto()]);

    const items = await driverService.getQueue();

    expect(client.get).toHaveBeenCalledWith("/riders/me/queue");
    expect(items).toHaveLength(1);
    expect(items[0].actions).toEqual(["accept", "reject"]);
  });

  it("accept POSTs /fulfillments/:id/accept and adapts the fulfillment", async () => {
    vi.mocked(client.post).mockResolvedValue(makeFulfillment({ status: "READY_FOR_PICKUP" }));

    const vm = await driverService.accept("ful1");

    expect(client.post).toHaveBeenCalledWith("/fulfillments/ful1/accept", { body: {} });
    expect(vm.status).toBe("READY_FOR_PICKUP");
  });

  it("reject omits the body when no reason, includes it otherwise", async () => {
    vi.mocked(client.post).mockResolvedValue(makeFulfillment());

    await driverService.reject("ful1");
    expect(client.post).toHaveBeenCalledWith("/fulfillments/ful1/reject", { body: {} });

    await driverService.reject("ful1", "too far");
    expect(client.post).toHaveBeenCalledWith("/fulfillments/ful1/reject", {
      body: { reason: "too far" },
    });
  });

  it("pickup / outForDelivery POST their routes with empty bodies", async () => {
    vi.mocked(client.post).mockResolvedValue(makeFulfillment());

    await driverService.pickup("ful1");
    expect(client.post).toHaveBeenCalledWith("/fulfillments/ful1/pickup", { body: {} });

    await driverService.outForDelivery("ful1");
    expect(client.post).toHaveBeenCalledWith("/fulfillments/ful1/out-for-delivery", { body: {} });
  });

  it("deliver omits/sends proof; fail sends the reason enum", async () => {
    vi.mocked(client.post).mockResolvedValue(makeFulfillment({ status: "DELIVERED" }));

    await driverService.deliver("ful1");
    expect(client.post).toHaveBeenCalledWith("/fulfillments/ful1/deliver", { body: {} });

    await driverService.deliver("ful1", "left at door");
    expect(client.post).toHaveBeenCalledWith("/fulfillments/ful1/deliver", {
      body: { proof: "left at door" },
    });

    await driverService.fail("ful1", "CUSTOMER_UNAVAILABLE");
    expect(client.post).toHaveBeenCalledWith("/fulfillments/ful1/fail", {
      body: { failureReason: "CUSTOMER_UNAVAILABLE" },
    });
  });

  it("recordLocation POSTs lat/lng and resolves void", async () => {
    vi.mocked(client.post).mockResolvedValue(undefined);

    await expect(driverService.recordLocation("ful1", 51.5, -0.16)).resolves.toBeUndefined();
    expect(client.post).toHaveBeenCalledWith("/fulfillments/ful1/location", {
      body: { lat: 51.5, lng: -0.16 },
    });
  });
});
