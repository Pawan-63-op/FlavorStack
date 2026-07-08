import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { canReviewOrder, getNextReviewOffset, invalidateReviewCaches, isOrderReviewable } from "./useReviews";
import { queryKeys } from "../queryKeys";
import type { ReviewsPage } from "../services/review";
import type { ReviewView } from "../adapters/review";
import type { TrackedOrder } from "../../orders/trackedOrders";

function makeView(overrides: Partial<ReviewView> = {}): ReviewView {
  return {
    id: "rev1",
    customerId: "cust1",
    restaurantId: "rest1",
    fulfillmentId: "ful1",
    restaurantRating: 5,
    deliveryRating: 4,
    comment: "Great",
    moderationStatus: "APPROVED",
    moderationStatusLabel: "Published",
    isPublished: true,
    createdAt: "2026-06-22T10:00:00.000Z",
    formattedDate: "Jun 22, 2026",
    authorLabel: "Verified customer",
    ...overrides,
  };
}

function makePage(items: ReviewView[], hasMore: boolean): ReviewsPage {
  return { items, hasMore };
}

function makeTrackedOrder(overrides: Partial<TrackedOrder> = {}): TrackedOrder {
  return {
    orderRequestId: "or1",
    restaurantName: "Test Restaurant",
    total: null,
    createdAt: "2026-06-22T10:00:00.000Z",
    idempotencyKey: "idem1",
    ...overrides,
  };
}

describe("getNextReviewOffset", () => {
  it("returns the next offset (pages * limit) while the last page has more", () => {
    const page = makePage([makeView()], true);
    expect(getNextReviewOffset(page, [page], 20)).toBe(20);
    expect(getNextReviewOffset(page, [page, page], 20)).toBe(40);
  });

  it("returns undefined (stop) once the last page reports no more", () => {
    const page = makePage([makeView()], false);
    expect(getNextReviewOffset(page, [page], 20)).toBeUndefined();
  });
});

describe("invalidateReviewCaches", () => {
  it("invalidates the restaurant list, my-list, and rating caches", () => {
    const invalidateQueries = vi.fn();
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    invalidateReviewCaches(queryClient, "rest1");

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.reviews.list("rest1"),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.reviews.myList(),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.reviews.rating("rest1"),
    });
  });
});

describe("canReviewOrder", () => {
  it("returns false when fulfillmentId is unknown", () => {
    expect(canReviewOrder(makeTrackedOrder({ fulfillmentId: undefined }))).toBe(false);
  });

  it("returns false when the order is not yet delivered", () => {
    expect(
      canReviewOrder(makeTrackedOrder({ fulfillmentId: "ful1", lastKnownStatus: "PREPARING" })),
    ).toBe(false);
  });

  it("returns false for a cancelled order", () => {
    expect(
      canReviewOrder(makeTrackedOrder({ fulfillmentId: "ful1", lastKnownStatus: "CANCELLED" })),
    ).toBe(false);
  });

  it("returns true once delivered with a known fulfillmentId", () => {
    expect(
      canReviewOrder(makeTrackedOrder({ fulfillmentId: "ful1", lastKnownStatus: "DELIVERED" })),
    ).toBe(true);
  });

  it("returns false when lastKnownStatus is unset", () => {
    expect(
      canReviewOrder(makeTrackedOrder({ fulfillmentId: "ful1", lastKnownStatus: undefined })),
    ).toBe(false);
  });
});

describe("isOrderReviewable", () => {
  it("is true only for a delivered order with a known fulfillmentId", () => {
    expect(isOrderReviewable("ful1", "DELIVERED")).toBe(true);
  });

  it("is false without a fulfillmentId, even when delivered", () => {
    expect(isOrderReviewable(null, "DELIVERED")).toBe(false);
    expect(isOrderReviewable(undefined, "DELIVERED")).toBe(false);
  });

  it("is false for non-delivered / terminal-but-not-delivered statuses", () => {
    for (const status of ["CREATED", "PREPARING", "OUT_FOR_DELIVERY", "CANCELLED", "FAILED"]) {
      expect(isOrderReviewable("ful1", status)).toBe(false);
    }
  });

  it("is false when the status is missing", () => {
    expect(isOrderReviewable("ful1", null)).toBe(false);
    expect(isOrderReviewable("ful1", undefined)).toBe(false);
  });
});
