import { describe, expect, it } from "vitest";
import type { VariantGroupViewModel } from "@/lib/api/adapters/menu";
import {
  defaultSelection,
  isSelectionValid,
  selectedOptionIds,
  selectionDeltaMinor,
  toggleOption,
  validateSelection,
} from "./variantSelection";

function option(id: string, over: Partial<VariantGroupViewModel["options"][number]> = {}) {
  return {
    id,
    label: id,
    priceDeltaMinor: 0,
    priceDelta: { amount: 0, currency: "INR" },
    formattedPriceDelta: "Free",
    isDefault: false,
    isAvailable: true,
    ...over,
  };
}

const sizeGroup: VariantGroupViewModel = {
  id: "g-size",
  label: "Size",
  selectionType: "SINGLE",
  required: true,
  minSelect: 1,
  maxSelect: 1,
  options: [
    option("half", { isDefault: true }),
    option("full", { priceDeltaMinor: 10000, priceDelta: { amount: 100, currency: "INR" } }),
  ],
};

const toppingsGroup: VariantGroupViewModel = {
  id: "g-top",
  label: "Toppings",
  selectionType: "MULTI",
  required: false,
  minSelect: 0,
  maxSelect: 2,
  options: [
    option("cheese", { priceDeltaMinor: 5000 }),
    option("olives", { priceDeltaMinor: 2500 }),
    option("basil", { priceDeltaMinor: 1000 }),
  ],
};

describe("defaultSelection", () => {
  it("pre-selects the default option of each group", () => {
    expect(defaultSelection([sizeGroup, toppingsGroup])).toEqual({
      "g-size": ["half"],
      "g-top": [],
    });
  });

  it("never pre-selects more than maxSelect", () => {
    const group: VariantGroupViewModel = {
      ...toppingsGroup,
      maxSelect: 1,
      options: [
        option("cheese", { isDefault: true }),
        option("olives", { isDefault: true }),
      ],
    };
    expect(defaultSelection([group])["g-top"]).toEqual(["cheese"]);
  });

  it("skips an unavailable default", () => {
    const group: VariantGroupViewModel = {
      ...sizeGroup,
      options: [option("half", { isDefault: true, isAvailable: false }), option("full")],
    };
    expect(defaultSelection([group])["g-size"]).toEqual([]);
  });
});

describe("toggleOption", () => {
  it("replaces the selection in a single-choice group", () => {
    const next = toggleOption({ "g-size": ["half"] }, sizeGroup, "full");
    expect(next["g-size"]).toEqual(["full"]);
  });

  it("refuses to deselect the only option of a required single-choice group", () => {
    const state = { "g-size": ["half"] };
    expect(toggleOption(state, sizeGroup, "half")).toBe(state);
  });

  it("allows deselecting in an optional single-choice group", () => {
    const optional = { ...sizeGroup, required: false };
    expect(toggleOption({ "g-size": ["half"] }, optional, "half")["g-size"]).toEqual([]);
  });

  it("adds and removes independently in a multi-select group", () => {
    let state = toggleOption({ "g-top": [] }, toppingsGroup, "cheese");
    state = toggleOption(state, toppingsGroup, "olives");
    expect(state["g-top"]).toEqual(["cheese", "olives"]);
    expect(toggleOption(state, toppingsGroup, "cheese")["g-top"]).toEqual(["olives"]);
  });

  it("refuses an addition beyond maxSelect", () => {
    const state = { "g-top": ["cheese", "olives"] };
    expect(toggleOption(state, toppingsGroup, "basil")).toBe(state);
  });
});

describe("validateSelection", () => {
  it("passes when every required group is answered", () => {
    expect(isSelectionValid([sizeGroup, toppingsGroup], { "g-size": ["half"], "g-top": [] })).toBe(
      true,
    );
  });

  it("flags an unanswered required group", () => {
    const errors = validateSelection([sizeGroup], { "g-size": [] });
    expect(errors["g-size"]).toBe("Choose at least 1");
  });

  it("treats an optional group as all-or-nothing against minSelect", () => {
    const group: VariantGroupViewModel = { ...toppingsGroup, minSelect: 2 };
    expect(validateSelection([group], { "g-top": [] })).toEqual({});
    expect(validateSelection([group], { "g-top": ["cheese"] })["g-top"]).toBe("Choose at least 2");
    expect(validateSelection([group], { "g-top": ["cheese", "olives"] })).toEqual({});
  });

  it("flags a selection over maxSelect", () => {
    const errors = validateSelection([toppingsGroup], {
      "g-top": ["cheese", "olives", "basil"],
    });
    expect(errors["g-top"]).toBe("Choose at most 2");
  });
});

describe("selectedOptionIds / selectionDeltaMinor", () => {
  it("flattens ids in group order", () => {
    expect(
      selectedOptionIds([sizeGroup, toppingsGroup], {
        "g-size": ["full"],
        "g-top": ["cheese", "basil"],
      }),
    ).toEqual(["full", "cheese", "basil"]);
  });

  it("sums the minor-unit deltas of every selected option", () => {
    expect(
      selectionDeltaMinor([sizeGroup, toppingsGroup], {
        "g-size": ["full"],
        "g-top": ["cheese", "basil"],
      }),
    ).toBe(10000 + 5000 + 1000);
  });

  it("ignores an id that no longer exists in its group", () => {
    expect(selectionDeltaMinor([sizeGroup], { "g-size": ["gone"] })).toBe(0);
  });
});
