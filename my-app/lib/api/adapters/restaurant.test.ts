import { describe, expect, it } from "vitest";
import {
  cuisineLabel,
  restaurantAdapter,
  type RestaurantSummaryResponse,
} from "./restaurant";

function makeRestaurantSummary(
  overrides: Partial<RestaurantSummaryResponse> = {},
): RestaurantSummaryResponse {
  return {
    id: "r1",
    name: "Spice Route",
    slug: "spice-route",
    cuisineTypes: ["NORTH_INDIAN", "CHINESE"],
    status: "ACTIVE",
    isOpen: true,
    location: { lat: 12.34, lng: 56.78 },
    imageUrl: "https://example.com/spice-route.png",
    ...overrides,
  };
}

describe("restaurantAdapter", () => {
  it("maps a RestaurantSummaryView to the FE view-model", () => {
    const dto = makeRestaurantSummary();

    const restaurant = restaurantAdapter(dto);

    expect(restaurant).toEqual({
      id: "r1",
      name: "Spice Route",
      slug: "spice-route",
      cuisineTypes: ["NORTH_INDIAN", "CHINESE"],
      cuisine: "North Indian",
      isOpen: true,
      status: "ACTIVE",
      lat: 12.34,
      lng: 56.78,
      imageUrl: "https://example.com/spice-route.png",
    });
  });

  it("derives cuisine from the first cuisineTypes entry", () => {
    const restaurant = restaurantAdapter(
      makeRestaurantSummary({ cuisineTypes: ["SEAFOOD", "BAKERY"] }),
    );

    expect(restaurant.cuisine).toBe("Seafood");
    expect(restaurant.cuisineTypes).toEqual(["SEAFOOD", "BAKERY"]);
  });

  it("maps an empty cuisineTypes array to an empty cuisine label", () => {
    const restaurant = restaurantAdapter(makeRestaurantSummary({ cuisineTypes: [] }));

    expect(restaurant.cuisine).toBe("");
  });

  it("maps a missing imageUrl to undefined", () => {
    const dto = makeRestaurantSummary();
    delete dto.imageUrl;

    const restaurant = restaurantAdapter(dto);

    expect(restaurant.imageUrl).toBeUndefined();
  });

  it("never fabricates rating/reviewCount from the summary DTO", () => {
    const restaurant = restaurantAdapter(makeRestaurantSummary());

    expect(restaurant.rating).toBeUndefined();
    expect(restaurant.reviewCount).toBeUndefined();
  });

  it("maps isOpen=false through unchanged", () => {
    const restaurant = restaurantAdapter(makeRestaurantSummary({ isOpen: false }));

    expect(restaurant.isOpen).toBe(false);
  });
});

describe("cuisineLabel", () => {
  it("returns a human-readable label for every CuisineType", () => {
    expect(cuisineLabel("NORTH_INDIAN")).toBe("North Indian");
    expect(cuisineLabel("SOUTH_INDIAN")).toBe("South Indian");
    expect(cuisineLabel("CHINESE")).toBe("Chinese");
    expect(cuisineLabel("ITALIAN")).toBe("Italian");
    expect(cuisineLabel("MEXICAN")).toBe("Mexican");
    expect(cuisineLabel("CONTINENTAL")).toBe("Continental");
    expect(cuisineLabel("FAST_FOOD")).toBe("Fast Food");
    expect(cuisineLabel("BAKERY")).toBe("Bakery");
    expect(cuisineLabel("DESSERTS")).toBe("Desserts");
    expect(cuisineLabel("BEVERAGES")).toBe("Beverages");
    expect(cuisineLabel("SEAFOOD")).toBe("Seafood");
    expect(cuisineLabel("STREET_FOOD")).toBe("Street Food");
  });
});
