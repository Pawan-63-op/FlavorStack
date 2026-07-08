import { describe, expect, it } from "vitest";
import {
  getDeliveryStatusInfo,
  getFulfillmentStatusInfo,
  getOrderRequestStatusInfo,
} from "./statusMap";

const FULFILLMENT_STATUSES = [
  "CREATED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "FAILED",
];

const TIMELINE_STATUSES = [
  "CREATED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "ASSIGNED",
  "REASSIGNED",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "FAILED",
];

const DELIVERY_STATUSES = [
  "UNASSIGNED",
  "ASSIGNED",
  "EN_ROUTE_TO_RESTAURANT",
  "AT_RESTAURANT",
  "PICKED_UP",
  "EN_ROUTE_TO_CUSTOMER",
  "DELIVERED",
  "FAILED",
];

describe("getFulfillmentStatusInfo", () => {
  it.each(FULFILLMENT_STATUSES)("returns a defined label for %s", (status) => {
    const info = getFulfillmentStatusInfo(status);
    expect(info.label).toBeTruthy();
    expect(typeof info.isActive).toBe("boolean");
    expect(typeof info.isTerminal).toBe("boolean");
  });

  it("marks DELIVERED, CANCELLED, FAILED as terminal", () => {
    expect(getFulfillmentStatusInfo("DELIVERED").isTerminal).toBe(true);
    expect(getFulfillmentStatusInfo("CANCELLED").isTerminal).toBe(true);
    expect(getFulfillmentStatusInfo("FAILED").isTerminal).toBe(true);
  });

  it("marks CREATED, PREPARING, OUT_FOR_DELIVERY as active and non-terminal", () => {
    for (const status of ["CREATED", "PREPARING", "READY_FOR_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"]) {
      const info = getFulfillmentStatusInfo(status);
      expect(info.isActive).toBe(true);
      expect(info.isTerminal).toBe(false);
    }
  });

  it("returns a safe default for an unknown status string", () => {
    const info = getFulfillmentStatusInfo("SOME_FUTURE_STATUS");
    expect(info.label).toBeTruthy();
    expect(info.isActive).toBe(false);
    expect(info.isTerminal).toBe(false);
  });

  it.each(TIMELINE_STATUSES)("surfaces a real (non-Unknown) label for timeline status %s", (status) => {
    const info = getFulfillmentStatusInfo(status);
    expect(info.label).not.toBe("Unknown");
    expect(info.icon).not.toBe("unknown");
  });

  it("labels the rider assignment milestones surfaced in the timeline", () => {
    expect(getFulfillmentStatusInfo("ASSIGNED").label).toBe("Rider assigned");
    expect(getFulfillmentStatusInfo("REASSIGNED").label).toBe("Rider reassigned");
    expect(getFulfillmentStatusInfo("ASSIGNED").isActive).toBe(true);
    expect(getFulfillmentStatusInfo("ASSIGNED").isTerminal).toBe(false);
  });
});

describe("getDeliveryStatusInfo", () => {
  it.each(DELIVERY_STATUSES)("returns a defined label for %s", (status) => {
    const info = getDeliveryStatusInfo(status);
    expect(info.label).toBeTruthy();
  });

  it("marks DELIVERED and FAILED as terminal", () => {
    expect(getDeliveryStatusInfo("DELIVERED").isTerminal).toBe(true);
    expect(getDeliveryStatusInfo("FAILED").isTerminal).toBe(true);
  });

  it("returns a safe default for an unknown status string", () => {
    const info = getDeliveryStatusInfo("WHATEVER");
    expect(info.label).toBeTruthy();
    expect(info.isTerminal).toBe(false);
  });
});

describe("getOrderRequestStatusInfo", () => {
  it('labels REQUESTED as "Order placed"', () => {
    expect(getOrderRequestStatusInfo("REQUESTED").label).toBe("Order placed");
  });

  it("returns a safe default for an unknown status string", () => {
    const info = getOrderRequestStatusInfo("WHATEVER");
    expect(info.label).toBeTruthy();
  });
});
