import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import {
  deriveUnreadFromPages,
  getNextNotificationOffset,
  invalidateNotificationCaches,
} from "./useNotifications";
import { queryKeys } from "../queryKeys";
import type { NotificationsPage } from "../services/notification";
import type { NotificationView } from "../adapters/notification";

function makeView(overrides: Partial<NotificationView> = {}): NotificationView {
  return {
    id: "n1",
    category: "ORDER_UPDATES",
    title: "Order confirmed",
    body: "Your order has been confirmed.",
    templateKey: "order_confirmed",
    createdAt: "2026-06-22T10:00:00.000Z",
    readAt: null,
    isRead: false,
    formattedTime: "2 hours ago",
    icon: "package",
    variant: "default",
    link: null,
    ...overrides,
  };
}

function makePage(items: NotificationView[], hasMore: boolean): NotificationsPage {
  return { items, hasMore };
}

describe("getNextNotificationOffset", () => {
  it("returns the next offset (pages * limit) while the last page has more", () => {
    const page = makePage([makeView()], true);
    expect(getNextNotificationOffset(page, [page], 20)).toBe(20);
    expect(getNextNotificationOffset(page, [page, page], 20)).toBe(40);
  });

  it("returns undefined (stop) once the last page reports no more", () => {
    const page = makePage([makeView()], false);
    expect(getNextNotificationOffset(page, [page], 20)).toBeUndefined();
  });
});

describe("deriveUnreadFromPages", () => {
  it("counts only not-yet-read items across all loaded pages", () => {
    const pages = [
      makePage([makeView({ isRead: false }), makeView({ id: "n2", isRead: true })], true),
      makePage([makeView({ id: "n3", isRead: false })], false),
    ];
    expect(deriveUnreadFromPages(pages)).toBe(2);
  });

  it("returns 0 for no pages", () => {
    expect(deriveUnreadFromPages([])).toBe(0);
  });
});

describe("invalidateNotificationCaches", () => {
  it("invalidates both the list and unread-count query keys", () => {
    const invalidateQueries = vi.fn();
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    invalidateNotificationCaches(queryClient);

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.notifications.list(),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.notifications.unreadCount(),
    });
  });
});
