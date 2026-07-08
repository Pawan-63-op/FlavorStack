import { describe, expect, it } from "vitest";
import {
  emptyMenuItemFormState,
  parseTags,
  validateMenuItemForm,
  type MenuItemFormState,
} from "./MenuItemForm";

function makeState(overrides: Partial<MenuItemFormState> = {}): MenuItemFormState {
  return { ...emptyMenuItemFormState("c1"), name: "Paneer Tikka", price: 250, ...overrides };
}

describe("parseTags", () => {
  it("splits, trims, and drops empties", () => {
    expect(parseTags(" popular ,  chef-special , ")).toEqual(["popular", "chef-special"]);
  });

  it("de-duplicates", () => {
    expect(parseTags("a, a, b")).toEqual(["a", "b"]);
  });

  it("returns an empty array for blank input", () => {
    expect(parseTags("   ")).toEqual([]);
  });
});

describe("validateMenuItemForm", () => {
  it("passes a well-formed item", () => {
    expect(validateMenuItemForm(makeState()).valid).toBe(true);
  });

  it("requires a category", () => {
    const v = validateMenuItemForm(makeState({ categoryId: "" }));
    expect(v.valid).toBe(false);
    expect(v.categoryError).not.toBeNull();
  });

  it("requires a name within 120 chars", () => {
    expect(validateMenuItemForm(makeState({ name: "" })).nameError).not.toBeNull();
    expect(validateMenuItemForm(makeState({ name: "x".repeat(121) })).nameError).not.toBeNull();
  });

  it("rejects a negative price", () => {
    expect(validateMenuItemForm(makeState({ price: -1 })).priceError).not.toBeNull();
    expect(validateMenuItemForm(makeState({ price: 0 })).priceError).toBeNull();
  });

  it("rejects an over-long tag", () => {
    expect(validateMenuItemForm(makeState({ tagsText: "x".repeat(41) })).tagsError).not.toBeNull();
    expect(validateMenuItemForm(makeState({ tagsText: "spicy, mild" })).tagsError).toBeNull();
  });

  it("rejects an over-long description", () => {
    expect(
      validateMenuItemForm(makeState({ description: "x".repeat(2001) })).descriptionError,
    ).not.toBeNull();
  });
});
