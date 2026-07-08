"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { isEnabled } from "../../config/featureFlags";
import { getFulfillmentStatusInfo } from "../../orders/statusMap";
import type { TrackedOrder } from "../../orders/trackedOrders";
import { useAuthStore } from "../../../store/authStore";
import { queryKeys } from "../queryKeys";
import { reviewService, type CreateReviewInput, type ReviewsPage } from "../services/review";

/**
 * Reviews query + mutation hooks (Batch 9.1) — thin TanStack wrappers over
 * `reviewService`. Restaurant/my-reviews lists are offset-paginated bare
 * arrays (no total), so pagination + "load more" mirror the Phase 8
 * notifications hooks. Reads/writes are gated by the `reviews` feature flag.
 */

const DEFAULT_LIMIT = 20;

/**
 * Offset of the next page for the bare-array list: pages are full `limit`
 * windows, so the next offset is `pagesSoFar * limit` while the last page
 * still reports `hasMore`; `undefined` stops pagination (TanStack's "no next
 * page").
 */
export function getNextReviewOffset(
  lastPage: ReviewsPage,
  allPages: ReviewsPage[],
  limit = DEFAULT_LIMIT,
): number | undefined {
  return lastPage.hasMore ? allPages.length * limit : undefined;
}

/**
 * Invalidate the caches a review submission affects: the restaurant's public
 * list, the submitter's my-reviews list, and the restaurant's aggregate
 * rating. Pure over a `QueryClient` so the mutation wiring is unit-testable
 * without rendering.
 */
export function invalidateReviewCaches(queryClient: QueryClient, restaurantId: string): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.list(restaurantId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.myList() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.rating(restaurantId) });
}

/**
 * Verified-purchase eligibility from the raw linkage fields (Phase 7 linkage):
 * reviewable only once a `fulfillmentId` is known **and** the last known status
 * is the terminal `DELIVERED` state. Field-level so the "Leave a review" entry
 * points (G8 — `OrderHistory`, `OrderTracking`) can gate on a `TrackingView`'s
 * `currentStatus`/`fulfillmentId` without first building a `TrackedOrder`.
 */
export function isOrderReviewable(
  fulfillmentId: string | null | undefined,
  lastKnownStatus: string | null | undefined,
): boolean {
  if (!fulfillmentId || !lastKnownStatus) return false;
  const statusInfo = getFulfillmentStatusInfo(lastKnownStatus);
  return statusInfo.isTerminal && lastKnownStatus === "DELIVERED";
}

/**
 * Verified-purchase eligibility for a tracked order — delegates to
 * {@link isOrderReviewable}. Used by `FeedbackPage`'s final gate.
 */
export function canReviewOrder(order: TrackedOrder): boolean {
  return isOrderReviewable(order.fulfillmentId, order.lastKnownStatus);
}

/** Offset-paginated approved reviews for a restaurant via `useInfiniteQuery` ("load more"). Public. */
export function useRestaurantReviews(restaurantId: string, limit = DEFAULT_LIMIT) {
  return useInfiniteQuery({
    queryKey: queryKeys.reviews.list(restaurantId, { limit }),
    queryFn: ({ pageParam }) =>
      reviewService.listRestaurantReviews(restaurantId, { limit, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => getNextReviewOffset(lastPage, allPages, limit),
    enabled: isEnabled("reviews") && Boolean(restaurantId),
  });
}

/** Offset-paginated own reviews (all moderation statuses) via `useInfiniteQuery`. Requires auth. */
export function useMyReviews(limit = DEFAULT_LIMIT) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useInfiniteQuery({
    queryKey: queryKeys.reviews.myList({ limit }),
    queryFn: ({ pageParam }) => reviewService.listMyReviews({ limit, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => getNextReviewOffset(lastPage, allPages, limit),
    enabled: isEnabled("reviews") && isAuthenticated,
  });
}

/** Aggregate rating + distribution for a restaurant. Public. */
export function useRestaurantRating(restaurantId: string) {
  return useQuery({
    queryKey: queryKeys.reviews.rating(restaurantId),
    queryFn: () => reviewService.getRestaurantRating(restaurantId),
    enabled: isEnabled("reviews") && Boolean(restaurantId),
  });
}

/** Submit a dual-rating review; invalidates the restaurant list, my-list, and rating caches. */
export function useSubmitReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReviewInput) => reviewService.createReview(input),
    onSuccess: (_review, input) => invalidateReviewCaches(queryClient, input.restaurantId),
  });
}
