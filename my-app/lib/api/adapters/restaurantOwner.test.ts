import { describe, expect, it } from "vitest";
import { ApiError } from "../errors/ApiError";
import {
  ownerRestaurantAdapter,
  toAddCategoryBody,
  toCreateRestaurantBody,
  toManageZoneBody,
  toMajorMoney,
  toMinorMoney,
  toUpdateCategoryBody,
  toUpdateRestaurantBody,
  type OwnerRestaurantResponse,
  type RestaurantFormValues,
} from "./restaurantOwner";

function makeResponse(
  overrides: Partial<OwnerRestaurantResponse> = {},
): OwnerRestaurantResponse {
  return {
    id: "r1",
    ownerId: "owner1",
    name: "Spice Route",
    slug: "spice-route",
    description: "Tasty",
    cuisineTypes: ["NORTH_INDIAN"],
    address: {
      street: "1 Main St",
      city: "Pune",
      state: "MH",
      pinCode: "411001",
      coordinates: { lat: 18.5, lng: 73.8 },
    },
    location: { lat: 18.5, lng: 73.8 },
    phone: "+912012345678",
    status: "DRAFT",
    visibility: "HIDDEN",
    categories: [
      { id: "c2", label: "Mains", sortOrder: 2, isActive: true },
      { id: "c1", label: "Starters", sortOrder: 1, isActive: false },
    ],
    deliveryZones: [
      {
        id: "z1",
        polygon: { points: [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, { lat: 3, lng: 3 }] },
        feeMatrix: {
          tiers: [{ maxDistanceMeters: 2000, fee: { amount: 5000, currency: "INR" } }],
          freeAboveSubtotal: { amount: 50000, currency: "INR" },
        },
        minOrder: { amount: 10000, currency: "INR" },
      },
    ],
    version: 3,
    ...overrides,
  };
}

function makeForm(overrides: Partial<RestaurantFormValues> = {}): RestaurantFormValues {
  return {
    name: "Spice Route",
    cuisineTypes: ["NORTH_INDIAN"],
    address: {
      street: "1 Main St",
      city: "Pune",
      state: "MH",
      pinCode: "411001",
      coordinates: { lat: 18.5, lng: 73.8 },
    },
    location: { lat: 18.5, lng: 73.8 },
    phone: "+912012345678",
    ...overrides,
  };
}

describe("money helpers", () => {
  it("converts major → minor units, rounding, with optional currency", () => {
    expect(toMinorMoney(50)).toEqual({ amount: 5000 });
    expect(toMinorMoney(50, "INR")).toEqual({ amount: 5000, currency: "INR" });
    expect(toMinorMoney(12.345, "USD")).toEqual({ amount: 1235, currency: "USD" });
  });

  it("converts minor → major units", () => {
    expect(toMajorMoney({ amount: 5000, currency: "INR" })).toEqual({
      amount: 50,
      currency: "INR",
    });
  });
});

describe("ownerRestaurantAdapter", () => {
  it("sorts categories by sortOrder and derives canPublish from active categories", () => {
    const view = ownerRestaurantAdapter(makeResponse());
    expect(view.categories.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(view.canPublish).toBe(true); // c2 is active
  });

  it("canPublish is false when no category is active", () => {
    const view = ownerRestaurantAdapter(
      makeResponse({
        categories: [{ id: "c1", label: "Starters", sortOrder: 1, isActive: false }],
      }),
    );
    expect(view.canPublish).toBe(false);
  });

  it("converts delivery-zone money to major units with formatted strings", () => {
    const view = ownerRestaurantAdapter(makeResponse());
    const zone = view.deliveryZones[0];
    expect(zone.minOrder).toEqual({ amount: 100, currency: "INR" });
    expect(zone.tiers[0].fee).toEqual({ amount: 50, currency: "INR" });
    expect(zone.freeAboveSubtotal).toEqual({ amount: 500, currency: "INR" });
    expect(zone.polygon).toHaveLength(3);
  });
});

describe("toCreateRestaurantBody", () => {
  it("builds a body, omitting undefined optional fields", () => {
    const body = toCreateRestaurantBody(makeForm());
    expect(body).toEqual({
      name: "Spice Route",
      cuisineTypes: ["NORTH_INDIAN"],
      address: makeForm().address,
      location: { lat: 18.5, lng: 73.8 },
      phone: "+912012345678",
    });
    expect("slug" in body).toBe(false);
    expect("description" in body).toBe(false);
  });

  it("keeps slug when provided", () => {
    const body = toCreateRestaurantBody(makeForm({ slug: "my-slug" }));
    expect(body.slug).toBe("my-slug");
  });

  it("throws 422 on an unknown cuisine type", () => {
    expect(() =>
      toCreateRestaurantBody(
        makeForm({ cuisineTypes: ["MARTIAN" as never] }),
      ),
    ).toThrowError(ApiError);
  });
});

describe("toUpdateRestaurantBody", () => {
  it("strips undefined keys and never emits slug", () => {
    const body = toUpdateRestaurantBody({ name: "New" });
    expect(body).toEqual({ name: "New" });
    expect("slug" in body).toBe(false);
  });

  it("throws 422 when no fields are provided", () => {
    expect(() => toUpdateRestaurantBody({})).toThrowError("No updatable fields provided");
  });
});

describe("category bodies", () => {
  it("builds an add-category body omitting undefined sortOrder", () => {
    expect(toAddCategoryBody({ label: "Mains" })).toEqual({ label: "Mains" });
    expect(toAddCategoryBody({ label: "Mains", sortOrder: 2 })).toEqual({
      label: "Mains",
      sortOrder: 2,
    });
  });

  it("throws when an update-category body is empty", () => {
    expect(() => toUpdateCategoryBody({})).toThrowError(ApiError);
    expect(toUpdateCategoryBody({ isActive: false })).toEqual({ isActive: false });
  });
});

describe("toManageZoneBody", () => {
  it("converts tier/minOrder/freeAbove money to minor units", () => {
    const body = toManageZoneBody({
      action: "ADD",
      polygon: [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, { lat: 3, lng: 3 }],
      feeMatrix: { tiers: [{ maxDistanceMeters: 2000, fee: 50 }], freeAboveSubtotal: 500 },
      minOrder: 100,
      currency: "INR",
    });
    expect(body.feeMatrix?.tiers[0].fee).toEqual({ amount: 5000, currency: "INR" });
    expect(body.feeMatrix?.freeAboveSubtotal).toEqual({ amount: 50000, currency: "INR" });
    expect(body.minOrder).toEqual({ amount: 10000, currency: "INR" });
  });

  it("supports a bare REMOVE action with just a zoneId", () => {
    expect(toManageZoneBody({ action: "REMOVE", zoneId: "z1" })).toEqual({
      action: "REMOVE",
      zoneId: "z1",
    });
  });

  it("throws 422 on an unknown action", () => {
    expect(() => toManageZoneBody({ action: "DESTROY" as never })).toThrowError(ApiError);
  });
});
