import { describe, expect, it } from "vitest";
import { restaurantRatingAdapter, type RestaurantRatingResponse } from "./reviewRating";

function makeRating(overrides: Partial<RestaurantRatingResponse> = {}): RestaurantRatingResponse {
  return {
    restaurantId: "rest1",
    avgRating: 4.2,
    reviewCount: 10,
    distribution: { 1: 1, 2: 0, 3: 1, 4: 3, 5: 5 },
    ...overrides,
  };
}

describe("restaurantRatingAdapter", () => {
  it("passes through restaurantId/avgRating/reviewCount", () => {
    const vm = restaurantRatingAdapter(makeRating());
    expect(vm.restaurantId).toBe("rest1");
    expect(vm.avgRating).toBe(4.2);
    expect(vm.reviewCount).toBe(10);
  });

  it("computes per-star percentages from the distribution, ordered 5→1", () => {
    const vm = restaurantRatingAdapter(makeRating());
    expect(vm.distribution).toEqual([
      { star: 5, count: 5, percentage: 50 },
      { star: 4, count: 3, percentage: 30 },
      { star: 3, count: 1, percentage: 10 },
      { star: 2, count: 0, percentage: 0 },
      { star: 1, count: 1, percentage: 10 },
    ]);
  });

  it("zeroes percentages when there are no reviews", () => {
    const vm = restaurantRatingAdapter(
      makeRating({
        avgRating: 0,
        reviewCount: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      }),
    );
    expect(vm.distribution.every((bar) => bar.percentage === 0)).toBe(true);
    expect(vm.avgRating).toBe(0);
    expect(vm.reviewCount).toBe(0);
  });

  it("rounds percentages to the nearest whole number", () => {
    const vm = restaurantRatingAdapter(
      makeRating({ reviewCount: 3, distribution: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 1 } }),
    );
    const fiveStar = vm.distribution.find((bar) => bar.star === 5);
    expect(fiveStar?.percentage).toBe(33);
  });
});
