import { describe, expect, it } from "vitest";
import { buildAvailabilityInput } from "./AvailabilityToggle";

describe("buildAvailabilityInput", () => {
  it("omits any reason when available", () => {
    expect(buildAvailabilityInput(true, "ignored")).toEqual({ isAvailable: true });
  });

  it("includes a trimmed reason when unavailable", () => {
    expect(buildAvailabilityInput(false, "  Sold out  ")).toEqual({
      isAvailable: false,
      outOfStockReason: "Sold out",
    });
  });

  it("omits the reason when unavailable with a blank reason", () => {
    expect(buildAvailabilityInput(false, "   ")).toEqual({ isAvailable: false });
  });
});
