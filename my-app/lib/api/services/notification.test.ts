import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationResponse } from "../adapters/notification";
import { client } from "../client/http";
import { notificationService } from "./notification";

vi.mock("../client/http", () => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
    raw: vi.fn(),
  },
}));

function makeDto(overrides: Partial<NotificationResponse> = {}): NotificationResponse {
  return {
    notificationId: "n1",
    recipientUserId: "u1",
    category: "ORDER_UPDATES",
    channel: "PUSH",
    templateKey: "order_confirmed",
    title: "Order confirmed",
    body: "Your order has been confirmed.",
    status: "SENT",
    provider: null,
    createdAt: "2026-06-22T10:00:00.000Z",
    ...overrides,
  };
}

describe("notificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listNotifications", () => {
    it("GETs /me/notifications with default limit/offset and adapts each item", async () => {
      vi.mocked(client.get).mockResolvedValue([makeDto()]);

      const page = await notificationService.listNotifications();

      expect(client.get).toHaveBeenCalledWith("/me/notifications?limit=20&offset=0");
      expect(page.items).toHaveLength(1);
      expect(page.items[0].id).toBe("n1");
    });

    it("passes through explicit limit/offset", async () => {
      vi.mocked(client.get).mockResolvedValue([]);

      await notificationService.listNotifications({ limit: 5, offset: 10 });

      expect(client.get).toHaveBeenCalledWith("/me/notifications?limit=5&offset=10");
    });

    it("reports hasMore=true at a full-page boundary", async () => {
      vi.mocked(client.get).mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => makeDto({ notificationId: `n${i}` })),
      );

      const page = await notificationService.listNotifications({ limit: 5 });

      expect(page.hasMore).toBe(true);
    });

    it("reports hasMore=false when a page returns fewer than limit", async () => {
      vi.mocked(client.get).mockResolvedValue([makeDto(), makeDto({ notificationId: "n2" })]);

      const page = await notificationService.listNotifications({ limit: 5 });

      expect(page.hasMore).toBe(false);
    });
  });

  describe("getUnreadCount", () => {
    it("GETs the unread-count endpoint and returns the bare count", async () => {
      vi.mocked(client.get).mockResolvedValue({ count: 7 });

      const count = await notificationService.getUnreadCount();

      expect(client.get).toHaveBeenCalledWith("/me/notifications/unread-count");
      expect(count).toBe(7);
    });
  });

  describe("markRead", () => {
    it("PATCHes the per-notification read endpoint", async () => {
      vi.mocked(client.patch).mockResolvedValue(undefined);

      await notificationService.markRead("n1");

      expect(client.patch).toHaveBeenCalledWith("/me/notifications/n1/read", {});
    });
  });
});
