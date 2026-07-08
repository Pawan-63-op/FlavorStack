import { describe, expect, it } from "vitest";
import { formatDate, formatRelativeTime } from "./date";

describe("formatDate", () => {
  it("formats an ISO timestamp to a locale medium date", () => {
    expect(formatDate("2026-01-15T00:00:00Z")).toBe("Jan 15, 2026");
  });

  it("returns a fallback for null", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("returns a fallback for undefined", () => {
    expect(formatDate(undefined)).toBe("—");
  });

  it("returns a fallback for an unparsable string", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-01-15T12:00:00Z");

  it("formats a past day as 'yesterday'", () => {
    expect(formatRelativeTime("2026-01-14T12:00:00Z", now)).toBe("yesterday");
  });

  it("formats a past number of hours", () => {
    expect(formatRelativeTime("2026-01-15T10:00:00Z", now)).toBe(
      "2 hours ago",
    );
  });

  it("formats a future number of minutes", () => {
    expect(formatRelativeTime("2026-01-15T12:03:00Z", now)).toBe(
      "in 3 minutes",
    );
  });

  it("returns a fallback for null", () => {
    expect(formatRelativeTime(null, now)).toBe("—");
  });

  it("returns a fallback for an unparsable string", () => {
    expect(formatRelativeTime("not-a-date", now)).toBe("—");
  });
});
