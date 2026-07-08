import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewResponse } from "../adapters/review";
import type { RestaurantRatingResponse } from "../adapters/reviewRating";
import { client } from "../client/http";
import { reviewService } from "./review";

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

function makeDto(overrides: Partial<ReviewResponse> = {}): ReviewResponse {
  return {
    reviewId: "rev1",
    customerId: "cust1",
    restaurantId: "rest1",
    fulfillmentId: "ful1",
    restaurantRating: 5,
    deliveryRating: 4,
    comment: "Great food",
    moderationStatus: "APPROVED",
    createdAt: "2026-06-22T10:00:00.000Z",
    ...overrides,
  };
}

function makeRatingDto(
  overrides: Partial<RestaurantRatingResponse> = {},
): RestaurantRatingResponse {
  return {
    restaurantId: "rest1",
    avgRating: 4.5,
    reviewCount: 2,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
    ...overrides,
  };
}

describe("reviewService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listRestaurantReviews", () => {
    it("GETs /restaurants/:id/reviews with default limit/offset and adapts each item", async () => {
      vi.mocked(client.get).mockResolvedValue([makeDto()]);

      const page = await reviewService.listRestaurantReviews("rest1");

      expect(client.get).toHaveBeenCalledWith("/restaurants/rest1/reviews?limit=20&offset=0");
      expect(page.items).toHaveLength(1);
      expect(page.items[0].id).toBe("rev1");
    });

    it("passes through explicit limit/offset", async () => {
      vi.mocked(client.get).mockResolvedValue([]);

      await reviewService.listRestaurantReviews("rest1", { limit: 5, offset: 10 });

      expect(client.get).toHaveBeenCalledWith("/restaurants/rest1/reviews?limit=5&offset=10");
    });

    it("reports hasMore=true at a full-page boundary", async () => {
      vi.mocked(client.get).mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => makeDto({ reviewId: `r${i}` })),
      );

      const page = await reviewService.listRestaurantReviews("rest1", { limit: 5 });

      expect(page.hasMore).toBe(true);
    });

    it("reports hasMore=false when a page returns fewer than limit", async () => {
      vi.mocked(client.get).mockResolvedValue([makeDto()]);

      const page = await reviewService.listRestaurantReviews("rest1", { limit: 5 });

      expect(page.hasMore).toBe(false);
    });
  });

  describe("listMyReviews", () => {
    it("GETs /me/reviews with default limit/offset and adapts each item", async () => {
      vi.mocked(client.get).mockResolvedValue([makeDto()]);

      const page = await reviewService.listMyReviews();

      expect(client.get).toHaveBeenCalledWith("/me/reviews?limit=20&offset=0");
      expect(page.items).toHaveLength(1);
    });

    it("passes through explicit limit/offset", async () => {
      vi.mocked(client.get).mockResolvedValue([]);

      await reviewService.listMyReviews({ limit: 5, offset: 10 });

      expect(client.get).toHaveBeenCalledWith("/me/reviews?limit=5&offset=10");
    });
  });

  describe("getRestaurantRating", () => {
    it("GETs the rating endpoint and adapts the response", async () => {
      vi.mocked(client.get).mockResolvedValue(makeRatingDto());

      const vm = await reviewService.getRestaurantRating("rest1");

      expect(client.get).toHaveBeenCalledWith("/restaurants/rest1/rating");
      expect(vm.restaurantId).toBe("rest1");
      expect(vm.avgRating).toBe(4.5);
    });
  });

  describe("createReview", () => {
    it("POSTs the dual-rating body to /restaurants/:id/reviews and adapts the response", async () => {
      vi.mocked(client.post).mockResolvedValue(makeDto());

      const vm = await reviewService.createReview({
        restaurantId: "rest1",
        fulfillmentId: "ful1",
        restaurantRating: 5,
        deliveryRating: 4,
        comment: "Great food",
      });

      expect(client.post).toHaveBeenCalledWith("/restaurants/rest1/reviews", {
        body: {
          fulfillmentId: "ful1",
          restaurantRating: 5,
          deliveryRating: 4,
          comment: "Great food",
        },
      });
      expect(vm.id).toBe("rev1");
    });

    it("omits restaurantId from the request body", async () => {
      vi.mocked(client.post).mockResolvedValue(makeDto());

      await reviewService.createReview({
        restaurantId: "rest1",
        fulfillmentId: "ful1",
        restaurantRating: 5,
      });

      const [, opts] = vi.mocked(client.post).mock.calls[0];
      expect(opts?.body).not.toHaveProperty("restaurantId");
    });
  });
});
