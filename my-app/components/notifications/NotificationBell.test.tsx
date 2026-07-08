import { describe, expect, it } from "vitest";
import { formatUnreadBadge } from "./NotificationBell";

describe("formatUnreadBadge", () => {
  it("renders small counts verbatim", () => {
    expect(formatUnreadBadge(1)).toBe("1");
    expect(formatUnreadBadge(9)).toBe("9");
  });

  it("caps counts above nine at '9+'", () => {
    expect(formatUnreadBadge(10)).toBe("9+");
    expect(formatUnreadBadge(42)).toBe("9+");
  });
});
