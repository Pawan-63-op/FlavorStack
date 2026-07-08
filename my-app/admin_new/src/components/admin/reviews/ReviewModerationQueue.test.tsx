import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors/ApiError";
import {
  moderationEmptyStateMessage,
  moderationErrorMessage,
} from "./ReviewModerationQueue";

describe("moderationEmptyStateMessage", () => {
  it("returns a status-specific message for each known status", () => {
    expect(moderationEmptyStateMessage("PENDING")).toBe("No pending reviews.");
    expect(moderationEmptyStateMessage("AUTO_FLAGGED")).toBe("No auto-flagged reviews.");
    expect(moderationEmptyStateMessage("APPROVED")).toBe("No approved reviews.");
    expect(moderationEmptyStateMessage("REJECTED")).toBe("No rejected reviews.");
  });
});

describe("moderationErrorMessage", () => {
  it("maps a 404 to a friendly already-handled message", () => {
    const error = new ApiError({ status: 404, code: "review_not_found", message: "not found" });
    expect(moderationErrorMessage(error)).toBe("This review was already handled by someone else.");
  });

  it("falls back to the API error's own message for other statuses", () => {
    const error = new ApiError({ status: 500, code: "INTERNAL", message: "boom" });
    expect(moderationErrorMessage(error)).toBe("boom");
  });

  it("falls back to a generic message for a non-ApiError", () => {
    expect(moderationErrorMessage(new Error("network down"))).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
