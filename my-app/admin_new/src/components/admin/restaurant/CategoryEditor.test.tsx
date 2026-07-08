import { describe, expect, it } from "vitest";
import { moveCategoryId, validateCategoryLabel } from "./CategoryEditor";

describe("validateCategoryLabel", () => {
  it("is invalid when empty", () => {
    expect(validateCategoryLabel("")).not.toBeNull();
    expect(validateCategoryLabel("   ")).not.toBeNull();
  });

  it("is valid for a non-empty label", () => {
    expect(validateCategoryLabel("Starters")).toBeNull();
  });
});

describe("moveCategoryId", () => {
  it("moves an id up by swapping with its predecessor", () => {
    expect(moveCategoryId(["a", "b", "c"], 1, "up")).toEqual(["b", "a", "c"]);
  });

  it("moves an id down by swapping with its successor", () => {
    expect(moveCategoryId(["a", "b", "c"], 1, "down")).toEqual(["a", "c", "b"]);
  });

  it("is a no-op moving the first id up", () => {
    expect(moveCategoryId(["a", "b", "c"], 0, "up")).toEqual(["a", "b", "c"]);
  });

  it("is a no-op moving the last id down", () => {
    expect(moveCategoryId(["a", "b", "c"], 2, "down")).toEqual(["a", "b", "c"]);
  });
});
