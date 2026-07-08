import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractNotificationLink,
  notificationAdapter,
  type NotificationResponse,
} from "./notification";

const FULFILLMENT_ID = "11111111-2222-4333-8444-555555555555";

function makeNotification(overrides: Partial<NotificationResponse> = {}): NotificationResponse {
  return {
    notificationId: "n1",
    recipientUserId: "u1",
    category: "ORDER_UPDATES",
    channel: "PUSH",
    templateKey: "order_confirmed",
    title: "Order confirmed",
    body: `Your order ${FULFILLMENT_ID} has been confirmed and is being prepared.`,
    status: "SENT",
    provider: null,
    createdAt: "2026-06-22T10:00:00.000Z",
    ...overrides,
  };
}

describe("notificationAdapter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-22T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("maps notificationId→id and carries the core fields", () => {
    const vm = notificationAdapter(makeNotification());
    expect(vm.id).toBe("n1");
    expect(vm.category).toBe("ORDER_UPDATES");
    expect(vm.title).toBe("Order confirmed");
    expect(vm.templateKey).toBe("order_confirmed");
    expect(vm.createdAt).toBe("2026-06-22T10:00:00.000Z");
  });

  it("derives isRead from status === 'READ'", () => {
    expect(notificationAdapter(makeNotification({ status: "READ" })).isRead).toBe(true);
    expect(notificationAdapter(makeNotification({ status: "SENT" })).isRead).toBe(false);
    expect(notificationAdapter(makeNotification({ status: "PENDING" })).isRead).toBe(false);
  });

  it("carries readAt, defaulting an absent value to null", () => {
    expect(notificationAdapter(makeNotification({ readAt: undefined })).readAt).toBeNull();
    expect(
      notificationAdapter(makeNotification({ readAt: "2026-06-22T11:00:00.000Z" })).readAt,
    ).toBe("2026-06-22T11:00:00.000Z");
  });

  it("derives a relative formattedTime against the current clock", () => {
    expect(notificationAdapter(makeNotification()).formattedTime).toBe("2 hours ago");
  });

  it("maps category to an icon and badge variant", () => {
    expect(notificationAdapter(makeNotification({ category: "DELIVERY" }))).toMatchObject({
      icon: "truck",
      variant: "default",
    });
    expect(notificationAdapter(makeNotification({ category: "SECURITY" }))).toMatchObject({
      icon: "shield",
      variant: "destructive",
    });
    expect(notificationAdapter(makeNotification({ category: "PROMOTIONS" }))).toMatchObject({
      icon: "tag",
      variant: "secondary",
    });
  });

  it("falls back to a default presentation for an unknown category", () => {
    const vm = notificationAdapter(makeNotification({ category: "MYSTERY" }));
    expect(vm.icon).toBe("bell");
    expect(vm.variant).toBe("outline");
  });
});

describe("extractNotificationLink", () => {
  it("returns a tracking link for an order_confirmed body containing a fulfillment id", () => {
    const link = extractNotificationLink(makeNotification());
    expect(link).toEqual({
      href: `/order-processing?fulfillmentId=${FULFILLMENT_ID}`,
    });
  });

  it("returns a link for a DELIVERY notification with a parseable id", () => {
    const link = extractNotificationLink(
      makeNotification({
        category: "DELIVERY",
        templateKey: "rider_assigned",
        body: `A rider has been assigned to your order ${FULFILLMENT_ID}.`,
      }),
    );
    expect(link?.href).toContain(FULFILLMENT_ID);
  });

  it("returns null for a SECURITY notification", () => {
    const link = extractNotificationLink(
      makeNotification({
        category: "SECURITY",
        templateKey: "password_changed",
        body: "Your FlavorStack password was changed.",
      }),
    );
    expect(link).toBeNull();
  });

  it("returns null when an order notification has no parseable id (documented gap)", () => {
    const link = extractNotificationLink(
      makeNotification({ body: "Your order has been confirmed." }),
    );
    expect(link).toBeNull();
  });
});
