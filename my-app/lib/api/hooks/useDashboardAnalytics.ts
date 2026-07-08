"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../../store/authStore";
import { queryKeys } from "../queryKeys";
import { analyticsService } from "../services/analytics";

/**
 * Overview analytics hooks (Phase 15 / G13). Owners (any authenticated user
 * with ≥1 restaurant) read `/owner/analytics`; the platform admin reads the
 * platform-wide `/admin/analytics`. `useOverviewAnalytics` picks the scope from
 * `user.isAdmin` and only enables the matching query, so a non-admin never hits
 * the admin-gated endpoint (and vice-versa).
 */

export type AnalyticsScope = "OWNER" | "PLATFORM";

/** Pure scope selector — admins see platform-wide analytics, everyone else owner-scoped. */
export function analyticsScopeFor(isAdmin: boolean | undefined): AnalyticsScope {
  return isAdmin ? "PLATFORM" : "OWNER";
}

export function useOwnerAnalytics(days?: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.analytics.owner(days),
    queryFn: () => analyticsService.getOwner(days),
    enabled,
  });
}

export function usePlatformAnalytics(days?: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.analytics.platform(days),
    queryFn: () => analyticsService.getPlatform(days),
    enabled,
  });
}

/** Scope-aware Overview query: platform for admins, owner-scoped otherwise. */
export function useOverviewAnalytics(days?: number) {
  const isAdmin = useAuthStore((s) => s.user?.isAdmin);
  const scope = analyticsScopeFor(isAdmin);
  const owner = useOwnerAnalytics(days, scope === "OWNER");
  const platform = usePlatformAnalytics(days, scope === "PLATFORM");
  return scope === "PLATFORM" ? platform : owner;
}
