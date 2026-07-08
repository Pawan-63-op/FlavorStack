"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { isEnabled } from "../../config/featureFlags";
import { useAuthStore } from "../../../store/authStore";
import { queryKeys } from "../queryKeys";
import { notificationService } from "../services/notification";
import {
  diffPreferences,
  type NotificationPreferencesView,
  type PreferenceChannelMap,
} from "../adapters/notificationPreferences";

/**
 * Notification-preferences query + mutation hooks (Batch 8.3) — thin TanStack
 * wrappers over `notificationService`. Reads are gated by the `notifications`
 * flag + auth, mirroring the other notification hooks. The diff is computed in
 * an exported pure-ish helper so the "only changed entries / skip empty save"
 * logic is unit-testable without mounting a query.
 */

export interface PreferenceUpdateInput {
  prev: PreferenceChannelMap;
  next: PreferenceChannelMap;
}

/**
 * Compute the current→desired diff and `PUT` it — but skip the request entirely
 * when nothing changed, since the server rejects an empty `changes` array
 * (`min(1)`). Returns `null` for the skipped no-op so callers can tell.
 */
export function performPreferenceUpdate(
  input: PreferenceUpdateInput,
): Promise<NotificationPreferencesView | null> {
  const changes = diffPreferences(input.prev, input.next);
  if (changes.length === 0) return Promise.resolve(null);
  return notificationService.updatePreferences(changes);
}

/** Invalidate the cached preferences after a successful write. */
export function invalidatePreferenceCaches(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.preferences() });
}

/** Current preferences query, gated by the `notifications` flag + auth. */
export function useNotificationPreferences() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.notifications.preferences(),
    queryFn: () => notificationService.getPreferences(),
    enabled: isEnabled("notifications") && isAuthenticated,
  });
}

/** Persist a toggled preference state as a diff; invalidates the cache on success. */
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PreferenceUpdateInput) => performPreferenceUpdate(input),
    onSuccess: () => invalidatePreferenceCaches(queryClient),
  });
}
