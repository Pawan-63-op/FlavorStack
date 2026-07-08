import { describe, expect, it } from "vitest";
import { groupItemsByCategory } from "./MenuManagement";
import type { OwnerMenuItemView } from "@/lib/api";

function makeItem(id: string, categoryId: string): OwnerMenuItemView {
  return {
    id,
    restaurantId: "r1",
    categoryId,
    name: id,
    basePrice: { amount: 100, currency: "INR" },
    formattedBasePrice: "₹100.00",
    tags: [],
    dietary: [],
    isVegetarian: false,
    availability: { isAvailable: true },
    isAvailable: true,
    variantGroups: [],
    version: 0,
  };
}

describe("groupItemsByCategory", () => {
  const categories = [
    { id: "c1", label: "Starters" },
    { id: "c2", label: "Mains" },
  ];

  it("buckets items under their category, preserving category order", () => {
    const groups = groupItemsByCategory(
      [makeItem("i1", "c2"), makeItem("i2", "c1"), makeItem("i3", "c2")],
      categories,
    );
    expect(groups.map((g) => g.label)).toEqual(["Starters", "Mains"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["i2"]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["i1", "i3"]);
  });

  it("keeps empty categories (as empty buckets) and adds no orphan bucket when all matched", () => {
    const groups = groupItemsByCategory([makeItem("i1", "c1")], categories);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.id === "__uncategorized__")).toBeUndefined();
  });

  it("collects items with unknown categories into a trailing Uncategorized bucket", () => {
    const groups = groupItemsByCategory([makeItem("i1", "ghost")], categories);
    const orphan = groups[groups.length - 1];
    expect(orphan.label).toBe("Uncategorized");
    expect(orphan.items.map((i) => i.id)).toEqual(["i1"]);
  });
});
