import { describe, expect, it } from "vitest";
import { ApiError } from "../errors/ApiError";
import {
  ownerMenuItemAdapter,
  toAddMenuItemBody,
  toAvailabilityBody,
  toSetVariantsBody,
  toUpdateMenuItemBody,
  type MenuItemFormValues,
  type OwnerMenuItemResponse,
} from "./menuOwner";

function makeResponse(
  overrides: Partial<OwnerMenuItemResponse> = {},
): OwnerMenuItemResponse {
  return {
    id: "i1",
    restaurantId: "r1",
    categoryId: "c1",
    name: "Paneer Tikka",
    basePrice: { amount: 25000, currency: "INR" },
    tags: ["popular"],
    dietary: ["VEG"],
    availability: { isAvailable: true },
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
            label: "Large",
            priceDelta: { amount: 5000, currency: "INR" },
            isDefault: false,
            isAvailable: true,
          },
        ],
      },
    ],
    version: 2,
    ...overrides,
  };
}

function makeForm(overrides: Partial<MenuItemFormValues> = {}): MenuItemFormValues {
  return {
    categoryId: "c1",
    name: "Paneer Tikka",
    basePrice: 250,
    ...overrides,
  };
}

describe("ownerMenuItemAdapter", () => {
  it("converts basePrice and option priceDelta to major units with formatting", () => {
    const view = ownerMenuItemAdapter(makeResponse());
    expect(view.basePrice).toEqual({ amount: 250, currency: "INR" });
    expect(view.variantGroups[0].options[0].priceDelta).toEqual({
      amount: 50,
      currency: "INR",
    });
    expect(view.formattedBasePrice).toContain("250");
  });

  it("derives isVegetarian and surfaces availability", () => {
    expect(ownerMenuItemAdapter(makeResponse()).isVegetarian).toBe(true);
    expect(ownerMenuItemAdapter(makeResponse({ dietary: ["NON_VEG"] })).isVegetarian).toBe(
      false,
    );
    const unavailable = ownerMenuItemAdapter(
      makeResponse({ availability: { isAvailable: false, outOfStockReason: "Sold out" } }),
    );
    expect(unavailable.isAvailable).toBe(false);
    expect(unavailable.availability.outOfStockReason).toBe("Sold out");
  });
});

describe("toAddMenuItemBody", () => {
  it("emits `basePrice` in minor units and omits undefined fields", () => {
    const body = toAddMenuItemBody(makeForm({ currency: "INR" }));
    expect(body.basePrice).toEqual({ amount: 25000, currency: "INR" });
    expect("price" in body).toBe(false);
    expect("description" in body).toBe(false);
  });

  it("throws 422 on an unknown dietary tag", () => {
    expect(() =>
      toAddMenuItemBody(makeForm({ dietary: ["KETO" as never] })),
    ).toThrowError(ApiError);
  });
});

describe("toUpdateMenuItemBody", () => {
  it("emits `price` (NOT `basePrice`) in minor units", () => {
    const body = toUpdateMenuItemBody({ price: 300, currency: "INR" });
    expect(body.price).toEqual({ amount: 30000, currency: "INR" });
    expect("basePrice" in body).toBe(false);
  });

  it("throws 422 when no fields are provided", () => {
    expect(() => toUpdateMenuItemBody({})).toThrowError("No updatable fields provided");
  });
});

describe("toAvailabilityBody", () => {
  it("passes through, dropping undefined optionals", () => {
    expect(toAvailabilityBody({ isAvailable: false, outOfStockReason: "x" })).toEqual({
      isAvailable: false,
      outOfStockReason: "x",
    });
  });
});

describe("toSetVariantsBody", () => {
  it("converts option priceDelta to minor units and validates selectionType", () => {
    const body = toSetVariantsBody([
      {
        label: "Size",
        selectionType: "SINGLE",
        minSelect: 1,
        maxSelect: 1,
        options: [{ label: "Large", priceDelta: 50 }],
        currency: "INR",
      },
    ]);
    expect(body.groups[0].options?.[0].priceDelta).toEqual({ amount: 5000, currency: "INR" });
    expect(body.groups[0].selectionType).toBe("SINGLE");
  });

  it("throws 422 on an unknown selectionType", () => {
    expect(() =>
      toSetVariantsBody([
        { label: "x", selectionType: "TRIPLE" as never, minSelect: 0, maxSelect: 1 },
      ]),
    ).toThrowError(ApiError);
  });
});
