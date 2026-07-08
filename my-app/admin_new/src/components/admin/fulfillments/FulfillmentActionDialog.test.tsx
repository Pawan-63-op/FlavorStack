import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors/ApiError";
import {
  buildReassignRiderInput,
  fulfillmentActionErrorMessage,
} from "./FulfillmentActionDialog";

describe("buildReassignRiderInput", () => {
  it("returns undefined for a blank rider id (auto-pick)", () => {
    expect(buildReassignRiderInput("   ")).toBeUndefined();
    expect(buildReassignRiderInput("")).toBeUndefined();
  });

  it("returns the trimmed rider id when non-blank", () => {
    expect(buildReassignRiderInput("  rider9  ")).toBe("rider9");
  });
});

describe("fulfillmentActionErrorMessage", () => {
  it("maps reassign no_available_rider (409) to a friendly retry message", () => {
    const error = new ApiError({ status: 409, code: "no_available_rider", message: "conflict" });
    expect(fulfillmentActionErrorMessage("reassign", error)).toBe(
      "No rider currently available — try again shortly.",
    );
  });

  it("falls back to the server message for other reassign errors", () => {
    const error = new ApiError({ status: 404, code: "fulfillment_not_found", message: "gone" });
    expect(fulfillmentActionErrorMessage("reassign", error)).toBe("gone");
  });

  it("maps a cancel transition conflict to the can-no-longer-be-cancelled message", () => {
    const error = new ApiError({ status: 409, code: "invalid_transition", message: "bad transition" });
    expect(fulfillmentActionErrorMessage("cancel", error)).toBe(
      "This fulfillment can no longer be cancelled.",
    );
  });

  it("maps a cancel validation error to the same friendly message", () => {
    const error = new ApiError({ status: 422, code: "validation", message: "nope" });
    expect(fulfillmentActionErrorMessage("cancel", error)).toBe(
      "This fulfillment can no longer be cancelled.",
    );
  });

  it("falls back to the server message for other cancel errors (e.g. 500)", () => {
    const error = new ApiError({ status: 500, code: "INTERNAL", message: "boom" });
    expect(fulfillmentActionErrorMessage("cancel", error)).toBe("boom");
  });

  it("falls back to a generic message for a non-ApiError", () => {
    expect(fulfillmentActionErrorMessage("reassign", new Error("network down"))).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
