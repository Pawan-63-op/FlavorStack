import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RestaurantSummaryResponse } from "../adapters/restaurant";
import type { MenuItemResponse, MenuItemSearchResponse, RestaurantMenuResponse } from "../adapters/menu";
import { client } from "../client/http";
import { catalogService } from "./catalog";

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
    basePriceAmount: 29999,
    currency: "INR",
    tags: [],
    dietary: ["VEG"],
    isAvailable: true,
    ...overrides,
  };
}

describe("catalogService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listRestaurants", () => {
    it("GETs /catalog/restaurants with no query string by default", async () => {
      vi.mocked(client.get).mockResolvedValue({ items: [], nextCursor: null });

      await catalogService.listRestaurants();

      expect(client.get).toHaveBeenCalledWith("/catalog/restaurants");
    });

    it("builds the query string from cursor/limit/cuisineTypes/isOpen", async () => {
      vi.mocked(client.get).mockResolvedValue({ items: [], nextCursor: null });

      await catalogService.listRestaurants({
        cursor: "abc",
        limit: 10,
        cuisineTypes: ["CHINESE", "ITALIAN"],
        isOpen: true,
      });

      expect(client.get).toHaveBeenCalledWith(
        "/catalog/restaurants?cursor=abc&limit=10&cuisineTypes=CHINESE%2CITALIAN&isOpen=true",
      );
    });

    it("passes deliverableOnly with the point so the server does the intersection", async () => {
      vi.mocked(client.get).mockResolvedValue({ items: [], nextCursor: null });

      await catalogService.listRestaurants({ deliverableOnly: true, lat: 19, lng: 73 });

      expect(client.get).toHaveBeenCalledWith(
        "/catalog/restaurants?deliverableOnly=true&lat=19&lng=73",
      );
    });

    it("normalizes the page and adapts each restaurant", async () => {
      vi.mocked(client.get).mockResolvedValue({
        items: [makeRestaurantSummary()],
        nextCursor: "next1",
      });

      const page = await catalogService.listRestaurants();

      expect(page.items).toEqual([
        {
          id: "r1",
          name: "Spice Route",
          slug: "spice-route",
          cuisineTypes: ["NORTH_INDIAN"],
          cuisine: "North Indian",
          isOpen: true,
          status: "ACTIVE",
          lat: 12.34,
          lng: 56.78,
          imageUrl: undefined,
        },
      ]);
      expect(page.nextCursor).toBe("next1");
      expect(page.hasMore).toBe(true);
    });
  });

  describe("getRestaurant", () => {
    it("GETs /catalog/restaurants/:id and adapts the result", async () => {
      vi.mocked(client.get).mockResolvedValue(makeRestaurantSummary());

      const restaurant = await catalogService.getRestaurant("r1");

      expect(client.get).toHaveBeenCalledWith("/catalog/restaurants/r1");
      expect(restaurant.id).toBe("r1");
    });
  });

  describe("getMenu", () => {
    it("GETs /catalog/restaurants/:id/menu and adapts the result", async () => {
      const dto: RestaurantMenuResponse = {
        restaurant: makeRestaurantSummary(),
        categories: [{ id: "c1", label: "Starters", sortOrder: 1, items: [makeMenuItem()] }],
      };
      vi.mocked(client.get).mockResolvedValue(dto);

      const menu = await catalogService.getMenu("r1");

      expect(client.get).toHaveBeenCalledWith("/catalog/restaurants/r1/menu");
      expect(menu.restaurant.id).toBe("r1");
      expect(menu.categories[0].items[0].formattedPrice).toBe("₹299.99");
    });
  });

  describe("getItem", () => {
    it("GETs /catalog/items/:id and adapts the result", async () => {
      vi.mocked(client.get).mockResolvedValue({ ...makeMenuItem(), variantGroups: [] });

      const item = await catalogService.getItem("i1");

      expect(client.get).toHaveBeenCalledWith("/catalog/items/i1");
      expect(item.id).toBe("i1");
      expect(item.hasVariants).toBe(false);
    });

    it("maps variantGroups so the picker gets option ids and deltas", async () => {
      vi.mocked(client.get).mockResolvedValue({
        ...makeMenuItem(),
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
                label: "Full",
                priceDeltaAmount: 10000,
                currency: "INR",
                isDefault: false,
                isAvailable: true,
              },
            ],
          },
        ],
      });

      const item = await catalogService.getItem("i1");

      expect(item.hasVariants).toBe(true);
      expect(item.variantGroups[0].options[0]).toMatchObject({
        id: "o1",
        priceDeltaMinor: 10000,
        formattedPriceDelta: "+₹100.00",
      });
    });
  });

  describe("searchRestaurants", () => {
    it("GETs /catalog/search/restaurants with the query and adapts the page", async () => {
      vi.mocked(client.get).mockResolvedValue({ items: [makeRestaurantSummary()], nextCursor: null });

      const page = await catalogService.searchRestaurants({ query: "pizza" });

      expect(client.get).toHaveBeenCalledWith("/catalog/search/restaurants?q=pizza");
      expect(page.items[0].name).toBe("Spice Route");
      expect(page.hasMore).toBe(false);
    });
  });

  describe("searchItems", () => {
    it("GETs /catalog/search/items and adapts the page with restaurant name/slug", async () => {
      const dto: MenuItemSearchResponse = {
        ...makeMenuItem(),
        restaurantName: "Spice Route",
        restaurantSlug: "spice-route",
      };
      vi.mocked(client.get).mockResolvedValue({ items: [dto], nextCursor: null });

      const page = await catalogService.searchItems({ query: "tikka", dietary: ["VEG"] });

      expect(client.get).toHaveBeenCalledWith("/catalog/search/items?q=tikka&dietary=VEG");
      expect(page.items[0].restaurantName).toBe("Spice Route");
    });
  });

  describe("nearby", () => {
    it("GETs /catalog/nearby with lat/lng/radiusMeters and adapts the page", async () => {
      vi.mocked(client.get).mockResolvedValue({ items: [makeRestaurantSummary()], nextCursor: null });

      const page = await catalogService.nearby({ lat: 1.1, lng: 2.2, radiusMeters: 3000 });

      expect(client.get).toHaveBeenCalledWith(
        "/catalog/nearby?lat=1.1&lng=2.2&radiusMeters=3000",
      );
      expect(page.items).toHaveLength(1);
    });
  });

  describe("deliverable", () => {
    it("GETs /catalog/deliverable and unwraps restaurantIds", async () => {
      vi.mocked(client.get).mockResolvedValue({ restaurantIds: ["r1", "r2"] });

      const ids = await catalogService.deliverable({ lat: 1.1, lng: 2.2 });

      expect(client.get).toHaveBeenCalledWith("/catalog/deliverable?lat=1.1&lng=2.2");
      expect(ids).toEqual(["r1", "r2"]);
    });
  });

  describe("serviceability", () => {
    it("GETs /catalog/serviceability and maps the bare array with major-unit money", async () => {
      vi.mocked(client.get).mockResolvedValue([
        {
          restaurantId: "r1",
          name: "Spice Route",
          slug: "spice-route",
          distanceMeters: 1200,
          deliveryFee: { amount: 4999, currency: "INR" },
          minOrder: { amount: 19900, currency: "INR" },
        },
      ]);

      const results = await catalogService.serviceability({ lat: 1.1, lng: 2.2 });

      expect(client.get).toHaveBeenCalledWith("/catalog/serviceability?lat=1.1&lng=2.2");
      expect(results).toEqual([
        {
          restaurantId: "r1",
          name: "Spice Route",
          slug: "spice-route",
          distanceMeters: 1200,
          deliveryFee: { amount: 49.99, currency: "INR" },
          formattedDeliveryFee: "₹49.99",
          minOrder: { amount: 199, currency: "INR" },
          formattedMinOrder: "₹199.00",
        },
      ]);
    });
  });

  describe("getRating", () => {
    it("GETs /restaurants/:id/rating (review router, not /catalog) and returns the raw shape", async () => {
      const rating = {
        restaurantId: "r1",
        avgRating: 4.5,
        reviewCount: 12,
        distribution: { 1: 0, 2: 0, 3: 1, 4: 5, 5: 6 },
      };
      vi.mocked(client.get).mockResolvedValue(rating);

      const result = await catalogService.getRating("r1");

      expect(client.get).toHaveBeenCalledWith("/restaurants/r1/rating");
      expect(result).toEqual(rating);
    });
  });
});
