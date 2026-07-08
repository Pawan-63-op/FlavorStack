import { beforeEach, describe, expect, it, vi } from "vitest";
import { client } from "../client/http";
import { catalogOwnerService } from "./catalogOwner";
import type { OwnerRestaurantResponse, RestaurantFormValues } from "../adapters/restaurantOwner";
import type { OwnerMenuItemResponse } from "../adapters/menuOwner";

vi.mock("../client/http", () => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
    raw: vi.fn(),
  },
}));

function restaurantDto(
  overrides: Partial<OwnerRestaurantResponse> = {},
): OwnerRestaurantResponse {
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
    deliveryZones: [],
    version: 0,
    ...overrides,
  };
}

function itemDto(overrides: Partial<OwnerMenuItemResponse> = {}): OwnerMenuItemResponse {
  return {
    id: "i1",
    restaurantId: "r1",
    categoryId: "c1",
    name: "Paneer Tikka",
    basePrice: { amount: 25000, currency: "INR" },
    tags: [],
    dietary: ["VEG"],
    availability: { isAvailable: true },
    variantGroups: [],
    version: 0,
    ...overrides,
  };
}

const baseForm: RestaurantFormValues = {
  name: "Spice Route",
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
};

describe("catalogOwnerService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("restaurant profile / lifecycle", () => {
    it("createRestaurant POSTs the built body and adapts the response", async () => {
      vi.mocked(client.post).mockResolvedValue(restaurantDto());
      const view = await catalogOwnerService.createRestaurant({ ...baseForm });
      expect(client.post).toHaveBeenCalledWith("/catalog/restaurants", {
        body: {
          name: "Spice Route",
          cuisineTypes: ["NORTH_INDIAN"],
          address: baseForm.address,
          location: { lat: 1, lng: 1 },
          phone: "+912012345678",
        },
      });
      expect(view.id).toBe("r1");
      expect(view.canPublish).toBe(false);
    });

    it("listOwnerRestaurants GETs /mine and adapts each item", async () => {
      vi.mocked(client.get).mockResolvedValue({
        items: [restaurantDto({ id: "r1" }), restaurantDto({ id: "r2", name: "Curry Co" })],
      });
      const views = await catalogOwnerService.listOwnerRestaurants();
      expect(client.get).toHaveBeenCalledWith("/catalog/restaurants/mine");
      expect(views.map((v) => v.id)).toEqual(["r1", "r2"]);
      expect(views[0].canPublish).toBe(false);
    });

    it("listOwnerRestaurants returns [] when the owner has no restaurants", async () => {
      vi.mocked(client.get).mockResolvedValue({ items: [] });
      await expect(catalogOwnerService.listOwnerRestaurants()).resolves.toEqual([]);
    });

    it("updateRestaurant PATCHes only provided fields", async () => {
      vi.mocked(client.patch).mockResolvedValue(restaurantDto({ name: "New" }));
      await catalogOwnerService.updateRestaurant("r1", { name: "New" });
      expect(client.patch).toHaveBeenCalledWith("/catalog/restaurants/r1", {
        body: { name: "New" },
      });
    });

    it("deleteRestaurant DELETEs and resolves void", async () => {
      vi.mocked(client.del).mockResolvedValue(undefined);
      await expect(catalogOwnerService.deleteRestaurant("r1")).resolves.toBeUndefined();
      expect(client.del).toHaveBeenCalledWith("/catalog/restaurants/r1");
    });

    it.each(["publish", "pause", "close"] as const)(
      "%s POSTs the lifecycle endpoint",
      async (action) => {
        vi.mocked(client.post).mockResolvedValue(restaurantDto({ status: "ACTIVE" }));
        await catalogOwnerService[action]("r1");
        expect(client.post).toHaveBeenCalledWith(`/catalog/restaurants/r1/${action}`);
      },
    );

    it("setVisibility PATCHes the visibility body", async () => {
      vi.mocked(client.patch).mockResolvedValue(restaurantDto({ visibility: "PUBLIC" }));
      await catalogOwnerService.setVisibility("r1", "PUBLIC");
      expect(client.patch).toHaveBeenCalledWith("/catalog/restaurants/r1/visibility", {
        body: { visibility: "PUBLIC" },
      });
    });

    it("setOpeningHours PUTs the schedule", async () => {
      vi.mocked(client.put).mockResolvedValue(restaurantDto());
      await catalogOwnerService.setOpeningHours("r1", {
        schedule: { MONDAY: [{ open: "09:00", close: "17:00" }] },
      });
      expect(client.put).toHaveBeenCalledWith("/catalog/restaurants/r1/opening-hours", {
        body: { schedule: { MONDAY: [{ open: "09:00", close: "17:00" }] } },
      });
    });

    it("uploadRestaurantImage sends raw binary with the file content-type", async () => {
      vi.mocked(client.raw).mockResolvedValue(restaurantDto({ imageUrl: "memory://x" }));
      const file = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
      const view = await catalogOwnerService.uploadRestaurantImage("r1", file);
      expect(client.raw).toHaveBeenCalledWith("POST", "/catalog/restaurants/r1/image", {
        body: file,
        contentType: "image/png",
      });
      expect(view.imageUrl).toBe("memory://x");
    });
  });

  describe("categories", () => {
    it("addCategory POSTs the label and adapts the parent response", async () => {
      vi.mocked(client.post).mockResolvedValue(
        restaurantDto({ categories: [{ id: "c1", label: "Mains", sortOrder: 1, isActive: true }] }),
      );
      const view = await catalogOwnerService.addCategory("r1", { label: "Mains" });
      expect(client.post).toHaveBeenCalledWith("/catalog/restaurants/r1/categories", {
        body: { label: "Mains" },
      });
      expect(view.canPublish).toBe(true);
    });

    it("reorderCategories POSTs the ordered ids", async () => {
      vi.mocked(client.post).mockResolvedValue(restaurantDto());
      await catalogOwnerService.reorderCategories("r1", ["c2", "c1"]);
      expect(client.post).toHaveBeenCalledWith("/catalog/restaurants/r1/categories/reorder", {
        body: { orderedCategoryIds: ["c2", "c1"] },
      });
    });

    it("updateCategory PATCHes the category", async () => {
      vi.mocked(client.patch).mockResolvedValue(restaurantDto());
      await catalogOwnerService.updateCategory("r1", "c1", { isActive: false });
      expect(client.patch).toHaveBeenCalledWith(
        "/catalog/restaurants/r1/categories/c1",
        { body: { isActive: false } },
      );
    });

    it("removeCategory DELETEs and adapts the returned restaurant", async () => {
      vi.mocked(client.del).mockResolvedValue(restaurantDto());
      const view = await catalogOwnerService.removeCategory("r1", "c1");
      expect(client.del).toHaveBeenCalledWith("/catalog/restaurants/r1/categories/c1");
      expect(view.id).toBe("r1");
    });
  });

  describe("delivery zones", () => {
    it("manageZone POSTs a body with money in minor units", async () => {
      vi.mocked(client.post).mockResolvedValue(restaurantDto());
      await catalogOwnerService.manageZone("r1", {
        action: "ADD",
        polygon: [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, { lat: 3, lng: 3 }],
        feeMatrix: { tiers: [{ maxDistanceMeters: 2000, fee: 50 }] },
        minOrder: 100,
        currency: "INR",
      });
      expect(client.post).toHaveBeenCalledWith("/catalog/restaurants/r1/zones", {
        body: {
          action: "ADD",
          polygon: [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, { lat: 3, lng: 3 }],
          feeMatrix: { tiers: [{ maxDistanceMeters: 2000, fee: { amount: 5000, currency: "INR" } }] },
          minOrder: { amount: 10000, currency: "INR" },
        },
      });
    });
  });

  describe("menu items", () => {
    it("addItem POSTs `basePrice` in minor units and adapts the item", async () => {
      vi.mocked(client.post).mockResolvedValue(itemDto());
      const view = await catalogOwnerService.addItem("r1", {
        categoryId: "c1",
        name: "Paneer Tikka",
        basePrice: 250,
        currency: "INR",
      });
      expect(client.post).toHaveBeenCalledWith("/catalog/restaurants/r1/items", {
        body: {
          categoryId: "c1",
          name: "Paneer Tikka",
          basePrice: { amount: 25000, currency: "INR" },
        },
      });
      expect(view.basePrice).toEqual({ amount: 250, currency: "INR" });
    });

    it("updateItem PATCHes `price` (never `basePrice`)", async () => {
      vi.mocked(client.patch).mockResolvedValue(itemDto({ basePrice: { amount: 30000, currency: "INR" } }));
      await catalogOwnerService.updateItem("i1", { price: 300, currency: "INR" });
      expect(client.patch).toHaveBeenCalledWith("/catalog/items/i1", {
        body: { price: { amount: 30000, currency: "INR" } },
      });
    });

    it("removeItem DELETEs and resolves void", async () => {
      vi.mocked(client.del).mockResolvedValue(undefined);
      await expect(catalogOwnerService.removeItem("i1")).resolves.toBeUndefined();
      expect(client.del).toHaveBeenCalledWith("/catalog/items/i1");
    });

    it("setAvailability PATCHes the availability body", async () => {
      vi.mocked(client.patch).mockResolvedValue(
        itemDto({ availability: { isAvailable: false, outOfStockReason: "Sold out" } }),
      );
      await catalogOwnerService.setAvailability("i1", {
        isAvailable: false,
        outOfStockReason: "Sold out",
      });
      expect(client.patch).toHaveBeenCalledWith("/catalog/items/i1/availability", {
        body: { isAvailable: false, outOfStockReason: "Sold out" },
      });
    });

    it("setVariants PUTs groups with priceDelta in minor units", async () => {
      vi.mocked(client.put).mockResolvedValue(itemDto());
      await catalogOwnerService.setVariants("i1", [
        {
          label: "Size",
          selectionType: "SINGLE",
          minSelect: 1,
          maxSelect: 1,
          options: [{ label: "Large", priceDelta: 50 }],
          currency: "INR",
        },
      ]);
      expect(client.put).toHaveBeenCalledWith("/catalog/items/i1/variants", {
        body: {
          groups: [
            {
              label: "Size",
              selectionType: "SINGLE",
              minSelect: 1,
              maxSelect: 1,
              options: [{ label: "Large", priceDelta: { amount: 5000, currency: "INR" } }],
            },
          ],
        },
      });
    });

    it("uploadItemImage sends raw binary", async () => {
      vi.mocked(client.raw).mockResolvedValue(itemDto({ imageUrl: "memory://item" }));
      const file = new Blob([new Uint8Array([9])], { type: "image/jpeg" });
      await catalogOwnerService.uploadItemImage("i1", file);
      expect(client.raw).toHaveBeenCalledWith("POST", "/catalog/items/i1/image", {
        body: file,
        contentType: "image/jpeg",
      });
    });
  });
});
