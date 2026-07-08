import { describe, expect, it } from "vitest";
import { analyticsScopeFor } from "./useDashboardAnalytics";

describe("analyticsScopeFor", () => {
  it("selects the platform scope for an admin", () => {
    expect(analyticsScopeFor(true)).toBe("PLATFORM");
  });

  it("selects the owner scope for a non-admin", () => {
    expect(analyticsScopeFor(false)).toBe("OWNER");
    expect(analyticsScopeFor(undefined)).toBe("OWNER");
  });
});
