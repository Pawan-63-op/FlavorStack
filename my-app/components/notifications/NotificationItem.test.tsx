import { describe, expect, it } from "vitest";
import { Bell, Package } from "lucide-react";
import {
  isNotificationActionable,
  notificationAriaLabel,
  notificationRowClassName,
  resolveNotificationIcon,
} from "./NotificationItem";
import type { NotificationView } from "@/lib/api/adapters/notification";

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

describe("resolveNotificationIcon", () => {
  it("maps a known icon name to its Lucide component", () => {
    expect(resolveNotificationIcon("package")).toBe(Package);
  });

  it("falls back to Bell for an unknown icon name", () => {
    expect(resolveNotificationIcon("mystery")).toBe(Bell);
  });
});

describe("isNotificationActionable", () => {
  it("is true when a deep-link was resolved", () => {
    expect(isNotificationActionable(makeView({ link: { href: "/order-processing?fulfillmentId=x" } }))).toBe(true);
  });

  it("is false when there is no link", () => {
    expect(isNotificationActionable(makeView({ link: null }))).toBe(false);
  });
});

describe("notificationRowClassName", () => {
  it("emphasizes unread rows with an accent background", () => {
    expect(notificationRowClassName(false)).toContain("bg-accent/40");
  });

  it("does not add the unread accent for read rows", () => {
    expect(notificationRowClassName(true)).not.toContain("bg-accent/40");
  });
});

describe("notificationAriaLabel", () => {
  it("marks unread notifications in the label", () => {
    expect(notificationAriaLabel(makeView({ isRead: false }))).toBe("Order confirmed, unread");
  });

  it("omits the unread suffix once read", () => {
    expect(notificationAriaLabel(makeView({ isRead: true }))).toBe("Order confirmed");
  });
});
