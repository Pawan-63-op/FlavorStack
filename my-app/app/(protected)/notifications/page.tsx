"use client";

import { Loader2 } from "lucide-react";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  useMarkNotificationRead,
  useNotifications,
} from "@/lib/api/hooks/useNotifications";
import { isEnabled } from "@/lib/config/featureFlags";
import type { NotificationView } from "@/lib/api/adapters/notification";

/**
 * Full notifications history (Batch 8.2) — offset-paginated "load more" driven
 * by {@link useNotifications}'s `fetchNextPage`. Loading/empty/error states come
 * straight off the query flags. Feature-flag gated, mirroring the header bell.
 */
export default function NotificationsPage() {
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useNotifications();
  const markRead = useMarkNotificationRead();

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const handleSelect = (notification: NotificationView) => {
    if (!notification.isRead) markRead.mutate(notification.id);
  };

  if (!isEnabled("notifications")) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="py-16 text-center text-muted-foreground">Notifications are not available.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Notifications</h1>

      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {!isLoading && isError && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              We couldn&apos;t load your notifications. Please try again.
            </p>
          )}

          {!isLoading && !isError && items.length === 0 && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          )}

          {!isLoading && !isError && items.length > 0 && (
            <div className="divide-y">
              {items.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {hasNextPage && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
