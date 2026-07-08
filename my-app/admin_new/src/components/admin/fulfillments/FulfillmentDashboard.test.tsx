import { describe, expect, it } from "vitest";
import {
  FULFILLMENT_STATUS_FILTERS,
  statusFilterToParam,
} from "./FulfillmentDashboard";

describe("statusFilterToParam", () => {
  it("maps ALL to undefined (no status query param)", () => {
    expect(statusFilterToParam("ALL")).toBeUndefined();
  });

  it("passes a concrete status through unchanged", () => {
    expect(statusFilterToParam("PREPARING")).toBe("PREPARING");
    expect(statusFilterToParam("CANCELLED")).toBe("CANCELLED");
  });
});

describe("FULFILLMENT_STATUS_FILTERS", () => {
  it("lists ALL first (the default) followed by the verified enum statuses", () => {
    expect(FULFILLMENT_STATUS_FILTERS[0]).toBe("ALL");
    expect(FULFILLMENT_STATUS_FILTERS).toContain("CREATED");
    expect(FULFILLMENT_STATUS_FILTERS).toContain("READY_FOR_PICKUP");
    expect(FULFILLMENT_STATUS_FILTERS).toContain("OUT_FOR_DELIVERY");
    expect(FULFILLMENT_STATUS_FILTERS).toContain("DELIVERED");
    expect(FULFILLMENT_STATUS_FILTERS).toContain("FAILED");
  });
});
