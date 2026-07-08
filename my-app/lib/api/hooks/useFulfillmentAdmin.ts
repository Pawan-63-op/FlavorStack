"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { isEnabled } from "../../config/featureFlags";
import { useAuthStore } from "../../../store/authStore";
import { queryKeys } from "../queryKeys";
import {
  fulfillmentAdminService,
  type AdminFulfillmentsPage,
  type ListAdminFulfillmentsParams,
} from "../services/fulfillmentAdmin";

/**
 * Fulfillment admin query + mutation hooks (Phase 11, Batch 11.2) — thin
 * TanStack wrappers over `fulfillmentAdminService`. The dashboard list is
 * offset-paginated (bare array, no total), so pagination mirrors the Phase 9 /
 * Batch 11.1 hooks. Gated on `isAdmin && isEnabled("adminOps")` — computed
 * independently here rather than imported from the dashboard's local variable.
 *
 * Mutations invalidate `fulfillmentAdmin.list` **broadly** (no per-item key in
 * this list, unlike reviews) since any filter combination could be showing the
 * affected row.
 */

const DEFAULT_LIMIT = 20;

/** Offset of the next page for the bare-array list — same derivation as Phase 9's `getNextReviewOffset`. */
export function getNextFulfillmentOffset(
  lastPage: AdminFulfillmentsPage,
  allPages: AdminFulfillmentsPage[],
  limit = DEFAULT_LIMIT,
): number | undefined {
  return lastPage.hasMore ? allPages.length * limit : undefined;
}

/** Invalidate every admin-fulfillment list query, regardless of its filter params. */
export function invalidateFulfillmentAdminCaches(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ["fulfillmentAdmin", "list"] });
}

function useCanManageFulfillments(): boolean {
  const isAdmin = useAuthStore((s) => s.user?.isAdmin);
  return Boolean(isAdmin) && isEnabled("adminOps");
}

/** Offset-paginated admin fulfillment dashboard via `useInfiniteQuery` ("load more"). Gated on admin + flag. */
export function useAdminFulfillments(
  params: Omit<ListAdminFulfillmentsParams, "limit" | "offset"> = {},
  limit = DEFAULT_LIMIT,
) {
  const canManage = useCanManageFulfillments();
  return useInfiniteQuery({
    queryKey: queryKeys.fulfillmentAdmin.list({ ...params, limit }),
    queryFn: ({ pageParam }) =>
      fulfillmentAdminService.listAdminFulfillments({ ...params, limit, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => getNextFulfillmentOffset(lastPage, allPages, limit),
    enabled: canManage,
  });
}

/** Reassign a rider (auto-pick when `riderId` omitted); invalidates the dashboard list. */
export function useReassignFulfillment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, riderId }: { id: string; riderId?: string }) =>
      fulfillmentAdminService.reassignFulfillment(id, riderId),
    onSuccess: () => invalidateFulfillmentAdminCaches(queryClient),
  });
}

/** Cancel a fulfillment (required reason); invalidates the dashboard list. */
export function useCancelFulfillment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      fulfillmentAdminService.cancelFulfillment(id, reason),
    onSuccess: () => invalidateFulfillmentAdminCaches(queryClient),
  });
}

/**
 * Read-only restaurant prep queue (Batch 11.3). Enabled once a `restaurantId`
 * is selected — **not** gated on `isAdmin`/`adminOps`: any authenticated owner
 * can read it, matching the server's actual auth model (no role/ownership
 * check). The Queue UI scopes the picker to owned restaurants as a UX
 * mitigation only.
 */
export function useRestaurantFulfillments(restaurantId: string, status?: string) {
  return useQuery({
    queryKey: queryKeys.fulfillmentAdmin.restaurantQueue(restaurantId, status),
    queryFn: () => fulfillmentAdminService.listRestaurantFulfillments(restaurantId, status),
    enabled: Boolean(restaurantId),
  });
}
