import { beforeEach, describe, expect, it } from "vitest";
import type { OwnerRestaurantView } from "../adapters/restaurantOwner";
import type { OwnerMenuItemView } from "../adapters/menuOwner";
import {
  getOwnerItem,
  getOwnerItems,
  getOwnerRestaurant,
  getOwnerRestaurants,
  removeOwnerItem,
  removeOwnerRestaurant,
  upsertOwnerItem,
  upsertOwnerRestaurant,
} from "./registry";

function makeRestaurant(
  overrides: Partial<OwnerRestaurantView> = {},
): OwnerRestaurantView {
  return {
    id: "r1",
    ownerId: "owner1",
    name: "Spice Route",
    slug: "spice-route",
    cuisineTypes: ["NORTH_INDIAN"],
    address: {
      street: "1 Main St",
      city: "Pune",
      state: "MH",
      pinCode: "411001",
      coordinates: { lat: 1, lng: 1 },
    },
    location: { lat: 1, lng: 1 },
    phone: "+912012345678",
    status: "DRAFT",
    visibility: "HIDDEN",
    categories: [],
    canPublish: false,
    deliveryZones: [],
    version: 0,
    ...overrides,
  };
}

function makeItem(overrides: Partial<OwnerMenuItemView> = {}): OwnerMenuItemView {
  return {
    id: "i1",
    restaurantId: "r1",
    categoryId: "c1",
    name: "Paneer Tikka",
    basePrice: { amount: 250, currency: "INR" },
    formattedBasePrice: "₹250.00",
    tags: [],
    dietary: ["VEG"],
    isVegetarian: true,
    availability: { isAvailable: true },
    isAvailable: true,
    variantGroups: [],
    version: 0,
    ...overrides,
  };
}

describe("owner catalog registry", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("upserts and reads back a restaurant snapshot by id", () => {
    upsertOwnerRestaurant(makeRestaurant());
    expect(getOwnerRestaurant("r1")?.name).toBe("Spice Route");
    expect(getOwnerRestaurants()).toHaveLength(1);
  });

  it("replaces an existing snapshot on re-upsert (no duplicate)", () => {
    upsertOwnerRestaurant(makeRestaurant());
    upsertOwnerRestaurant(makeRestaurant({ name: "Renamed", version: 1 }));
    expect(getOwnerRestaurants()).toHaveLength(1);
    expect(getOwnerRestaurant("r1")?.name).toBe("Renamed");
    expect(getOwnerRestaurant("r1")?.version).toBe(1);
  });

  it("filters restaurants by ownerId", () => {
    upsertOwnerRestaurant(makeRestaurant({ id: "r1", ownerId: "owner1" }));
    upsertOwnerRestaurant(makeRestaurant({ id: "r2", ownerId: "owner2" }));
    expect(getOwnerRestaurants("owner1").map((r) => r.id)).toEqual(["r1"]);
    expect(getOwnerRestaurants("owner2").map((r) => r.id)).toEqual(["r2"]);
  });

  it("removing a restaurant also drops its tracked items", () => {
    upsertOwnerRestaurant(makeRestaurant());
    upsertOwnerItem(makeItem());
    removeOwnerRestaurant("r1");
    expect(getOwnerRestaurant("r1")).toBeUndefined();
    expect(getOwnerItems("r1")).toEqual([]);
  });

  it("upserts, reads, and removes menu items scoped to a restaurant", () => {
    upsertOwnerItem(makeItem({ id: "i1" }));
    upsertOwnerItem(makeItem({ id: "i2", name: "Dal" }));
    expect(getOwnerItems("r1")).toHaveLength(2);
    expect(getOwnerItem("r1", "i2")?.name).toBe("Dal");

    upsertOwnerItem(makeItem({ id: "i2", name: "Dal Makhani", version: 1 }));
    expect(getOwnerItems("r1")).toHaveLength(2);
    expect(getOwnerItem("r1", "i2")?.name).toBe("Dal Makhani");

    removeOwnerItem("r1", "i1");
    expect(getOwnerItems("r1").map((i) => i.id)).toEqual(["i2"]);
  });

  it("survives a corrupt storage payload by returning empty", () => {
    window.localStorage.setItem("owner-catalog-registry", "not json{");
    expect(getOwnerRestaurants()).toEqual([]);
    expect(getOwnerItems("r1")).toEqual([]);
  });
});
