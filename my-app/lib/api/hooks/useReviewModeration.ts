"use client";

import { useInfiniteQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { isEnabled } from "../../config/featureFlags";
import { useAuthStore } from "../../../store/authStore";
import { queryKeys } from "../queryKeys";
import {
  reviewModerationService,
  type AdminReviewsPage,
  type ListAdminReviewsParams,
} from "../services/reviewModeration";

/**
 * Review moderation query + mutation hooks (Phase 11, Batch 11.1) — thin
 * TanStack wrappers over `reviewModerationService`. The admin queue is
 * offset-paginated (bare array, no total), so pagination mirrors the Phase 9
 * `useReviews` hooks. Gated on `isAdmin && isEnabled("adminOps")` — computed
 * independently here rather than imported from the dashboard's local
 * variable, per Batch 11.0's wiring.
 */

const DEFAULT_LIMIT = 20;

/** Offset of the next page for the bare-array list — same derivation as Phase 9's `getNextReviewOffset`. */
export function getNextAdminReviewOffset(
  lastPage: AdminReviewsPage,
  allPages: AdminReviewsPage[],
  limit = DEFAULT_LIMIT,
): number | undefined {
  return lastPage.hasMore ? allPages.length * limit : undefined;
}

/**
 * Invalidate the moderation queue cache, and — only when a review's approval
 * changed the public aggregate — the Phase 9 restaurant rating + public list
 * caches for that specific restaurant.
 */
export function invalidateReviewModerationCaches(
  queryClient: QueryClient,
  restaurantId?: string,
): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.reviewModeration.list() });
  if (restaurantId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.rating(restaurantId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.list(restaurantId) });
  }
}

function useCanModerateReviews(): boolean {
  const isAdmin = useAuthStore((s) => s.user?.isAdmin);
  return Boolean(isAdmin) && isEnabled("adminOps");
}

/** Offset-paginated admin review queue via `useInfiniteQuery` ("load more"). Defaults to PENDING when `status` is omitted. */
export function useAdminReviews(
  params: Omit<ListAdminReviewsParams, "limit" | "offset"> = {},
  limit = DEFAULT_LIMIT,
) {
  const canModerate = useCanModerateReviews();
  return useInfiniteQuery({
    queryKey: queryKeys.reviewModeration.list({ ...params, limit }),
    queryFn: ({ pageParam }) =>
      reviewModerationService.listAdminReviews({ ...params, limit, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => getNextAdminReviewOffset(lastPage, allPages, limit),
    enabled: canModerate,
  });
}

/** Approve a review; invalidates the moderation queue and (since approval changes the public aggregate) the public review/rating caches. */
export function useApproveReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      reviewModerationService.approveReview(id, reason),
    onSuccess: (review) => invalidateReviewModerationCaches(queryClient, review.restaurantId),
  });
}

/** Reject a review; invalidates only the moderation queue. */
export function useRejectReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      reviewModerationService.rejectReview(id, reason),
    onSuccess: () => invalidateReviewModerationCaches(queryClient),
  });
}
