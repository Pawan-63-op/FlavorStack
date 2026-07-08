"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { NotificationItem } from "./NotificationItem";
import {
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from "@/lib/api/hooks/useNotifications";
import type { NotificationView } from "@/lib/api/adapters/notification";

/**
 * Recent-notifications panel (Batch 8.2) rendered inside the header bell's
 * dropdown. Shows the first page of {@link useNotifications} plus the live
 * unread count; clicking a row marks it read (and, for order/delivery items
 * with a parseable id, deep-links into Phase 7 tracking). "View all" routes to
 * the full paginated `/notifications` page.
 *
 * Mounting on open gives refetch-on-open for free (Radix mounts the content
 * lazily, and the query's default mount behavior refetches). There is no
 * mark-all-read endpoint, so that action is intentionally omitted (Phase_8.md).
 */
export function NotificationDropdown({ onNavigate }: { onNavigate?: () => void }) {
  const { data, isLoading, isError } = useNotifications();
  const { data: unreadCount } = useUnreadCount();
  const markRead = useMarkNotificationRead();

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const handleSelect = (notification: NotificationView) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    onNavigate?.();
  };

  return (
    <div className="w-80 max-w-[90vw]">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="font-medium">Notifications</span>
        {unreadCount ? (
          <span className="text-xs text-muted-foreground">{unreadCount} unread</span>
        ) : null}
      </div>

      <div className="max-h-96 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {!isLoading && isError && (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            We couldn&apos;t load your notifications.
          </p>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            You&apos;re all caught up.
          </p>
        )}

        {!isLoading &&
          !isError &&
          items.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onSelect={handleSelect}
            />
          ))}
      </div>

      <div className="border-t px-3 py-2 text-center">
        <Link
          href="/notifications"
          onClick={onNavigate}
          className="text-sm text-primary hover:underline"
        >
          View all
        </Link>
      </div>
    </div>
  );
}
