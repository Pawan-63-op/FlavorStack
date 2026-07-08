import { describe, expect, it } from "vitest";
import {
  emptyVariantGroup,
  validateVariantGroups,
  viewGroupsToInput,
} from "./VariantGroupEditor";
import type { ItemVariantGroupView } from "@/lib/api/adapters/menuOwner";

describe("viewGroupsToInput", () => {
  it("maps view groups to input shape with priceDelta in major units", () => {
    const view: ItemVariantGroupView[] = [
      {
        id: "g1",
        label: "Size",
        selectionType: "SINGLE",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          {
            id: "o1",
            label: "Large",
            priceDelta: { amount: 50, currency: "INR" },
            formattedPriceDelta: "₹50.00",
            isDefault: true,
            isAvailable: true,
          },
        ],
      },
    ];
    expect(viewGroupsToInput(view)).toEqual([
      {
        label: "Size",
        selectionType: "SINGLE",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options: [{ label: "Large", priceDelta: 50, isDefault: true, isAvailable: true }],
      },
    ]);
  });
});

describe("validateVariantGroups", () => {
  it("accepts a valid group", () => {
    expect(
      validateVariantGroups([
        { label: "Size", selectionType: "SINGLE", required: true, minSelect: 1, maxSelect: 1, options: [{ label: "L", priceDelta: 0 }] },
      ]),
    ).toBeNull();
  });

  it("rejects a blank group label", () => {
    expect(validateVariantGroups([{ ...emptyVariantGroup(), label: "" }])).not.toBeNull();
  });

  it("rejects minSelect greater than maxSelect", () => {
    expect(
      validateVariantGroups([{ label: "x", selectionType: "MULTI", minSelect: 3, maxSelect: 2, options: [] }]),
    ).toBe("Min select cannot exceed max select");
  });

  it("rejects maxSelect below 1", () => {
    expect(
      validateVariantGroups([{ label: "x", selectionType: "SINGLE", minSelect: 0, maxSelect: 0, options: [] }]),
    ).not.toBeNull();
  });

  it("rejects a blank option label", () => {
    expect(
      validateVariantGroups([
        { label: "Size", selectionType: "SINGLE", minSelect: 0, maxSelect: 1, options: [{ label: "", priceDelta: 0 }] },
      ]),
    ).toBe("Every option needs a label");
  });
});
