import { describe, it, expect } from "vitest";
import { landingPathForRole } from "./roleLanding";

describe("landingPathForRole", () => {
  it("sends DRIVER to the driver surface", () => {
    expect(landingPathForRole("DRIVER")).toBe("/driver");
  });

  it("sends ADMIN to the admin console", () => {
    expect(landingPathForRole("ADMIN")).toBe("/admin");
  });

  it("sends CUSTOMER (incl. owners, who are CUSTOMERs) to Home", () => {
    expect(landingPathForRole("CUSTOMER")).toBe("/");
  });
});
