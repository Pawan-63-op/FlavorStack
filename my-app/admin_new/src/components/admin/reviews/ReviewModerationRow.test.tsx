import { describe, expect, it } from "vitest";
import { buildModerationReasonInput, canSubmitRejection } from "./ReviewModerationRow";

describe("buildModerationReasonInput", () => {
  it("returns undefined for a blank reason", () => {
    expect(buildModerationReasonInput("   ")).toBeUndefined();
    expect(buildModerationReasonInput("")).toBeUndefined();
  });

  it("returns the trimmed reason when non-blank", () => {
    expect(buildModerationReasonInput("  Looks fine  ")).toBe("Looks fine");
  });
});

describe("canSubmitRejection", () => {
  // The server (domain `Review.reject`) requires a non-empty rejection reason —
  // approve's reason is optional, reject's is mandatory. Gate "Confirm reject"
  // on this so we never POST an empty reason and 422.
  it("is false for a blank reason", () => {
    expect(canSubmitRejection("")).toBe(false);
    expect(canSubmitRejection("   ")).toBe(false);
  });

  it("is true once a non-blank reason is present", () => {
    expect(canSubmitRejection("Spam")).toBe(true);
    expect(canSubmitRejection("  off-topic  ")).toBe(true);
  });
});
