import { describe, expect, it } from "vitest";
import type { RestaurantSummaryResponse } from "./restaurant";
import {
  menuAdapter,
  menuItemAdapter,
  menuItemDetailAdapter,
  menuItemSearchAdapter,
  type MenuItemDetailResponse,
  type MenuItemResponse,
  type MenuItemSearchResponse,
  type RestaurantMenuResponse,
} from "./menu";

function makeRestaurantSummary(
  overrides: Partial<RestaurantSummaryResponse> = {},
): RestaurantSummaryResponse {
  return {
    id: "r1",
    name: "Spice Route",
    slug: "spice-route",
    cuisineTypes: ["NORTH_INDIAN"],
    status: "ACTIVE",
    isOpen: true,
    location: { lat: 12.34, lng: 56.78 },
    ...overrides,
  };
}

function makeMenuItem(overrides: Partial<MenuItemResponse> = {}): MenuItemResponse {
  return {
    id: "i1",
    restaurantId: "r1",
    categoryId: "c1",
    name: "Paneer Tikka",
    description: "Grilled cottage cheese",
    imageUrl: "https://example.com/paneer.png",
    basePriceAmount: 29999,
    currency: "INR",
    tags: ["spicy"],
    dietary: ["VEG"],
    isAvailable: true,
    ...overrides,
  };
}

describe("menuItemAdapter", () => {
  it("maps a MenuItemView to the FE view-model with major-unit money", () => {
    const item = menuItemAdapter(makeMenuItem());

    expect(item).toMatchObject({
      id: "i1",
      restaurantId: "r1",
      categoryId: "c1",
      name: "Paneer Tikka",
      description: "Grilled cottage cheese",
      imageUrl: "https://example.com/paneer.png",
      dietary: ["VEG"],
      isVegetarian: true,
      isAvailable: true,
      tags: ["spicy"],
    });
    expect(item.price).toEqual({ amount: 299.99, currency: "INR" });
    expect(item.formattedPrice).toBe("₹299.99");
  });

  it("exposes the raw integer minor-unit price for cart writes", () => {
    const item = menuItemAdapter(makeMenuItem({ basePriceAmount: 29999, currency: "INR" }));

    expect(item.unitPriceMinor).toEqual({ amount: 29999, currency: "INR" });
  });

  it("derives isVegetarian=true for VEGAN dietary tags", () => {
    const item = menuItemAdapter(makeMenuItem({ dietary: ["VEGAN"] }));

    expect(item.isVegetarian).toBe(true);
  });

  it("derives isVegetarian=false for NON_VEG dietary tags", () => {
    const item = menuItemAdapter(makeMenuItem({ dietary: ["NON_VEG"] }));

    expect(item.isVegetarian).toBe(false);
  });

  it("maps isAvailable=false through unchanged", () => {
    const item = menuItemAdapter(makeMenuItem({ isAvailable: false }));

    expect(item.isAvailable).toBe(false);
  });

  it("maps a missing description/imageUrl to undefined", () => {
    const dto = makeMenuItem();
    delete dto.description;
    delete dto.imageUrl;

    const item = menuItemAdapter(dto);

    expect(item.description).toBeUndefined();
    expect(item.imageUrl).toBeUndefined();
  });
});

describe("menuItemSearchAdapter", () => {
  it("maps a MenuItemSearchView, including restaurant name/slug", () => {
    const dto: MenuItemSearchResponse = {
      ...makeMenuItem(),
      restaurantName: "Spice Route",
      restaurantSlug: "spice-route",
    };

    const item = menuItemSearchAdapter(dto);

    expect(item.restaurantName).toBe("Spice Route");
    expect(item.restaurantSlug).toBe("spice-route");
    expect(item.price).toEqual({ amount: 299.99, currency: "INR" });
  });
});

describe("menuAdapter", () => {
  it("maps a RestaurantMenuView into restaurant + category-grouped items", () => {
    const dto: RestaurantMenuResponse = {
      restaurant: makeRestaurantSummary(),
      categories: [
        {
          id: "c1",
          label: "Starters",
          sortOrder: 1,
          items: [makeMenuItem({ id: "i1" }), makeMenuItem({ id: "i2", isAvailable: false })],
        },
      ],
    };

    const menu = menuAdapter(dto);

    expect(menu.restaurant.id).toBe("r1");
    expect(menu.restaurant.cuisine).toBe("North Indian");
    expect(menu.categories).toHaveLength(1);
    expect(menu.categories[0]).toMatchObject({ id: "c1", label: "Starters", sortOrder: 1 });
    expect(menu.categories[0].items).toHaveLength(2);
    expect(menu.categories[0].items[1].isAvailable).toBe(false);
  });

  it("maps an empty categories array to an empty list", () => {
    const dto: RestaurantMenuResponse = {
      restaurant: makeRestaurantSummary(),
      categories: [],
    };

    const menu = menuAdapter(dto);

    expect(menu.categories).toEqual([]);
  });
});

describe("menuItemDetailAdapter", () => {
  const detail = (over: Partial<MenuItemDetailResponse> = {}): MenuItemDetailResponse => ({
    id: "i1",
    restaurantId: "r1",
    categoryId: "c1",
    name: "Paneer Tikka",
    basePriceAmount: 29999,
    currency: "INR",
    tags: [],
    dietary: ["VEG"],
    isAvailable: true,
    variantGroups: [
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
            label: "Half",
            priceDeltaAmount: 0,
            currency: "INR",
            isDefault: true,
            isAvailable: true,
          },
          {
            id: "o2",
            label: "Full",
            priceDeltaAmount: 10000,
            currency: "INR",
            isDefault: false,
            isAvailable: true,
          },
        ],
      },
    ],
    ...over,
  });

  it("keeps the base item mapping and adds the variant groups", () => {
    const vm = menuItemDetailAdapter(detail());

    expect(vm.formattedPrice).toBe("₹299.99");
    expect(vm.hasVariants).toBe(true);
    expect(vm.variantGroups).toHaveLength(1);
    expect(vm.variantGroups[0]).toMatchObject({
      id: "g1",
      label: "Size",
      selectionType: "SINGLE",
      required: true,
      minSelect: 1,
      maxSelect: 1,
    });
  });

  it("keeps the minor-unit delta and formats a zero delta as Free", () => {
    const [half, full] = menuItemDetailAdapter(detail()).variantGroups[0].options;

    expect(half.priceDeltaMinor).toBe(0);
    expect(half.formattedPriceDelta).toBe("Free");
    expect(half.isDefault).toBe(true);
    expect(full.priceDeltaMinor).toBe(10000);
    expect(full.priceDelta).toEqual({ amount: 100, currency: "INR" });
    expect(full.formattedPriceDelta).toBe("+₹100.00");
  });

  it("reports hasVariants=false for an item with no groups, overriding a stale list flag", () => {
    const vm = menuItemDetailAdapter(detail({ variantGroups: [], hasVariants: true }));
    expect(vm.hasVariants).toBe(false);
    expect(vm.variantGroups).toEqual([]);
  });
});

describe("menuItemAdapter hasVariants", () => {
  it("defaults to false when the list read omits the flag", () => {
    const vm = menuItemAdapter({
      id: "i1",
      restaurantId: "r1",
      categoryId: "c1",
      name: "Paneer Tikka",
      basePriceAmount: 100,
      currency: "INR",
      tags: [],
      dietary: [],
      isAvailable: true,
    });
    expect(vm.hasVariants).toBe(false);
  });

  it("passes the flag through when present", () => {
    const vm = menuItemAdapter({
      id: "i1",
      restaurantId: "r1",
      categoryId: "c1",
      name: "Paneer Tikka",
      basePriceAmount: 100,
      currency: "INR",
      tags: [],
      dietary: [],
      isAvailable: true,
      hasVariants: true,
    });
    expect(vm.hasVariants).toBe(true);
  });
});
