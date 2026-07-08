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
import { notificationService, type NotificationsPage } from "../services/notification";

/**
 * Notifications query + mutation hooks (Batch 8.1) — thin TanStack wrappers over
 * `notificationService`. Reads are gated by the `notifications` feature flag and
 * the authenticated session (all `/me/notifications*` routes require auth).
 *
 * Freshness is polling-based (no notifications socket exists): the unread-count
 * query polls and refetches on window focus; the panel/page refetches on open.
 * Branching logic lives in the exported pure helpers so it is testable without
 * mounting a query.
 */

const DEFAULT_LIMIT = 20;
const UNREAD_POLL_INTERVAL_MS = 30_000;

/**
 * Offset of the next page for the bare-array list: pages are full `limit`
 * windows, so the next offset is `pagesSoFar * limit` while the last page still
 * reports `hasMore`; `undefined` stops pagination (TanStack's "no next page").
 */
export function getNextNotificationOffset(
  lastPage: NotificationsPage,
  allPages: NotificationsPage[],
  limit = DEFAULT_LIMIT,
): number | undefined {
  return lastPage.hasMore ? allPages.length * limit : undefined;
}

/** Total unread across loaded pages — flat count of not-yet-read items. */
export function deriveUnreadFromPages(pages: NotificationsPage[]): number {
  return pages.reduce(
    (sum, page) => sum + page.items.filter((item) => !item.isRead).length,
    0,
  );
}

/**
 * Invalidate the caches a mark-read mutation affects: the notifications list
 * (read-state changed) and the unread-count badge. Pure over a `QueryClient` so
 * the mutation wiring is unit-testable without rendering.
 */
export function invalidateNotificationCaches(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
}

/** Offset-paginated notifications list via `useInfiniteQuery` ("load more"). */
export function useNotifications(limit = DEFAULT_LIMIT) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useInfiniteQuery({
    queryKey: queryKeys.notifications.list({ limit }),
    queryFn: ({ pageParam }) => notificationService.listNotifications({ limit, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => getNextNotificationOffset(lastPage, allPages, limit),
    enabled: isEnabled("notifications") && isAuthenticated,
  });
}

/** Unread-count badge query: polls + refetches on focus, gated by flag + auth. */
export function useUnreadCount() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () => notificationService.getUnreadCount(),
    enabled: isEnabled("notifications") && isAuthenticated,
    refetchInterval: UNREAD_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
}

/** Mark a single notification read; invalidates the list + unread-count caches. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => invalidateNotificationCaches(queryClient),
  });
}
