import { describe, expect, it } from "vitest";
import {
  driverActionsForItem,
  formatQueueAddress,
  riderQueueItemAdapter,
  type RiderQueueItemResponse,
} from "./driver";

function makeQueueItem(
  overrides: Partial<RiderQueueItemResponse> = {},
): RiderQueueItemResponse {
  return {
    fulfillmentId: "ful1",
    assignmentStatus: "OFFERED",
    attempt: 1,
    expiresAt: "2026-06-26T10:05:00.000Z",
    restaurantId: "rest1",
    deliveryAddress: {
      label: "Home",
      street: "12 Baker St",
      city: "London",
      state: "LDN",
      pinCode: "NW16XE",
      coordinates: { lat: 51.5, lng: -0.16 },
    },
    total: { amount: 1599, currency: "USD" },
    fulfillmentStatus: "READY_FOR_PICKUP",
    offeredAt: "2026-06-26T10:00:00.000Z",
    updatedAt: "2026-06-26T10:01:00.000Z",
    ...overrides,
  };
}

describe("driverActionsForItem", () => {
  it("offers accept/reject for an OFFERED assignment regardless of fulfillment status", () => {
    expect(
      driverActionsForItem({ assignmentStatus: "OFFERED", fulfillmentStatus: "READY_FOR_PICKUP" }),
    ).toEqual(["accept", "reject"]);
  });

  it("advances an ACCEPTED assignment by fulfillment status", () => {
    expect(
      driverActionsForItem({ assignmentStatus: "ACCEPTED", fulfillmentStatus: "READY_FOR_PICKUP" }),
    ).toEqual(["pickup"]);
    expect(
      driverActionsForItem({ assignmentStatus: "ACCEPTED", fulfillmentStatus: "PICKED_UP" }),
    ).toEqual(["out-for-delivery"]);
    expect(
      driverActionsForItem({ assignmentStatus: "ACCEPTED", fulfillmentStatus: "OUT_FOR_DELIVERY" }),
    ).toEqual(["deliver", "fail"]);
  });

  it("offers nothing for a terminal/unknown fulfillment status or a non-active assignment", () => {
    expect(
      driverActionsForItem({ assignmentStatus: "ACCEPTED", fulfillmentStatus: "DELIVERED" }),
    ).toEqual([]);
    expect(
      driverActionsForItem({ assignmentStatus: "EXPIRED", fulfillmentStatus: "READY_FOR_PICKUP" }),
    ).toEqual([]);
  });
});

describe("formatQueueAddress", () => {
  it("joins non-blank parts with commas", () => {
    expect(
      formatQueueAddress({
        street: "12 Baker St",
        city: "London",
        state: "",
        pinCode: "NW16XE",
        coordinates: { lat: 0, lng: 0 },
      }),
    ).toBe("12 Baker St, London, NW16XE");
  });
});

describe("riderQueueItemAdapter", () => {
  it("maps the DTO, formats total/address/age, and derives actions", () => {
    const vm = riderQueueItemAdapter(
      makeQueueItem({ assignmentStatus: "ACCEPTED", fulfillmentStatus: "PICKED_UP" }),
    );

    expect(vm.fulfillmentId).toBe("ful1");
    expect(vm.fulfillmentStatusLabel).toBe("Picked up");
    expect(vm.formattedAddress).toBe("12 Baker St, London, LDN, NW16XE");
    expect(vm.formattedTotal).toContain("15.99");
    expect(vm.actions).toEqual(["out-for-delivery"]);
  });
});
