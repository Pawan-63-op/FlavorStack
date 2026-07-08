import { describe, expect, it } from "vitest";
import { AdminOnlyPanel } from "./AdminOnlyPanel";

describe("AdminOnlyPanel", () => {
  it("renders without props and without throwing", () => {
    const element = AdminOnlyPanel();
    expect(element).toBeTruthy();
    expect(element.type).toBeDefined();
  });
});
