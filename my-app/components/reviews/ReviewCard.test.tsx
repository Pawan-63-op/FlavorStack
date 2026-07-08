import { describe, expect, it } from "vitest";
import { moderationBadgeClassName } from "./ReviewCard";
import type { ModerationStatus } from "@/lib/api/adapters/review";

describe("moderationBadgeClassName", () => {
  it("uses amber for pending / auto-flagged reviews", () => {
    expect(moderationBadgeClassName("PENDING")).toContain("amber");
    expect(moderationBadgeClassName("AUTO_FLAGGED")).toContain("amber");
  });

  it("uses green for approved (published) reviews", () => {
    expect(moderationBadgeClassName("APPROVED")).toContain("green");
  });

  it("uses red for rejected reviews", () => {
    expect(moderationBadgeClassName("REJECTED")).toContain("red");
  });

  it("falls back to a neutral class for an unknown status", () => {
    expect(moderationBadgeClassName("WEIRD" as ModerationStatus)).toContain("muted-foreground");
  });
});
