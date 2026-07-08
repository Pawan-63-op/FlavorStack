"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { fulfillmentOwnerService } from "../services/fulfillmentOwner";

/**
 * Owner prep-progress mutation hooks (Phase 14.2) — thin TanStack wrappers over
 * `fulfillmentOwnerService`. On success they invalidate the restaurant's prep
 * queue across every status filter (optimistic refresh), so the advanced order
 * re-renders with its new status without a manual reload.
 *
 * The queue key is `["fulfillmentAdmin", "restaurantQueue", restaurantId,
 * status]`; invalidating the `restaurantId` prefix matches all status variants.
 */

/** Invalidate every prep-queue query for one restaurant, regardless of its status filter. */
export function invalidateRestaurantQueue(queryClient: QueryClient, restaurantId: string): void {
  void queryClient.invalidateQueries({
    queryKey: ["fulfillmentAdmin", "restaurantQueue", restaurantId],
  });
}

/** Mark a CREATED fulfillment as PREPARING; refreshes the owning restaurant's queue. */
export function useMarkPreparing(restaurantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, prepEstimateMinutes }: { id: string; prepEstimateMinutes?: number }) =>
      fulfillmentOwnerService.markPreparing(id, prepEstimateMinutes),
    onSuccess: () => invalidateRestaurantQueue(queryClient, restaurantId),
  });
}

/** Mark a PREPARING fulfillment as READY_FOR_PICKUP; refreshes the owning restaurant's queue. */
export function useMarkReady(restaurantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => fulfillmentOwnerService.markReady(id),
    onSuccess: () => invalidateRestaurantQueue(queryClient, restaurantId),
  });
}
