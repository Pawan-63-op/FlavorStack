import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import {
  getNextAdminReviewOffset,
  invalidateReviewModerationCaches,
} from "./useReviewModeration";
import { queryKeys } from "../queryKeys";
import type { AdminReviewsPage } from "../services/reviewModeration";
import type { ReviewView } from "../adapters/review";

function makeView(overrides: Partial<ReviewView> = {}): ReviewView {
  return {
    id: "rev1",
    customerId: "cust1",
    restaurantId: "rest1",
    fulfillmentId: "ful1",
    restaurantRating: 5,
    deliveryRating: 4,
    comment: "Great",
    moderationStatus: "PENDING",
    moderationStatusLabel: "Pending review",
    isPublished: false,
    createdAt: "2026-06-22T10:00:00.000Z",
    formattedDate: "Jun 22, 2026",
    authorLabel: "Verified customer",
    ...overrides,
  };
}

function makePage(items: ReviewView[], hasMore: boolean): AdminReviewsPage {
  return { items, hasMore };
}

describe("getNextAdminReviewOffset", () => {
  it("returns the next offset (pages * limit) while the last page has more", () => {
    const page = makePage([makeView()], true);
    expect(getNextAdminReviewOffset(page, [page], 20)).toBe(20);
    expect(getNextAdminReviewOffset(page, [page, page], 20)).toBe(40);
  });

  it("returns undefined (stop) once the last page reports no more", () => {
    const page = makePage([makeView()], false);
    expect(getNextAdminReviewOffset(page, [page], 20)).toBeUndefined();
  });
});

describe("invalidateReviewModerationCaches", () => {
  it("always invalidates the moderation queue", () => {
    const invalidateQueries = vi.fn();
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    invalidateReviewModerationCaches(queryClient);

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.reviewModeration.list(),
    });
  });

  it("also invalidates the restaurant's public rating + list when a restaurantId is given", () => {
    const invalidateQueries = vi.fn();
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    invalidateReviewModerationCaches(queryClient, "rest1");

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.reviewModeration.list(),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.reviews.rating("rest1"),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.reviews.list("rest1"),
    });
  });

  it("does not touch the public review caches when no restaurantId is given (reject)", () => {
    const invalidateQueries = vi.fn();
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    invalidateReviewModerationCaches(queryClient);

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });
});
