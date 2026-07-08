"use client";

import { createElement } from "react";
import Link from "next/link";
import { Bell, Package, Shield, Tag, Truck, type LucideIcon } from "lucide-react";
import type { NotificationView } from "@/lib/api/adapters/notification";
import { cn } from "@/components/ui/utils";

/**
 * Single notification row (Batch 8.2). Presentational: renders title/body/time
 * and read state, and — when the adapter resolved a best-effort tracking
 * deep-link — becomes a click target that routes to it. Clicking any row fires
 * `onSelect` so the container can mark it read. Branching logic lives in the
 * exported pure helpers below so it is unit-testable without a DOM renderer
 * (the repo has no React Testing Library).
 */

/** Maps the adapter's category icon name to a Lucide component, with a fallback. */
const ICON_BY_NAME: Record<string, LucideIcon> = {
  package: Package,
  truck: Truck,
  shield: Shield,
  tag: Tag,
  bell: Bell,
};

export function resolveNotificationIcon(name: string): LucideIcon {
  return ICON_BY_NAME[name] ?? Bell;
}

/** A row is actionable (clickable as a link) only when a deep-link was resolved. */
export function isNotificationActionable(view: NotificationView): boolean {
  return view.link !== null;
}

/** Row container classes; unread rows get an accent background + emphasis. */
export function notificationRowClassName(isRead: boolean): string {
  return cn(
    "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-accent",
    !isRead && "bg-accent/40",
  );
}

/** Accessible label conveying the read state to assistive tech. */
export function notificationAriaLabel(view: NotificationView): string {
  return `${view.title}${view.isRead ? "" : ", unread"}`;
}

interface NotificationItemProps {
  notification: NotificationView;
  /** Fired on click (mark-read); navigation, if any, happens via the link. */
  onSelect?: (notification: NotificationView) => void;
}

function NotificationBody({ notification }: { notification: NotificationView }) {
  return (
    <>
      <span className="mt-0.5 shrink-0 text-muted-foreground">
        {createElement(resolveNotificationIcon(notification.icon), { className: "h-4 w-4" })}
      </span>
      <span className="flex-1 space-y-0.5">
        <span className="flex items-center gap-2">
          <span className={cn("text-sm", !notification.isRead && "font-medium")}>
            {notification.title}
          </span>
          {!notification.isRead && (
            <span
              data-testid="notification-unread-dot"
              className="h-2 w-2 shrink-0 rounded-full bg-primary"
              aria-hidden="true"
            />
          )}
        </span>
        <span className="block text-sm text-muted-foreground">{notification.body}</span>
        <span className="block text-xs text-muted-foreground">{notification.formattedTime}</span>
      </span>
    </>
  );
}

export function NotificationItem({ notification, onSelect }: NotificationItemProps) {
  const handleSelect = () => onSelect?.(notification);

  if (notification.link) {
    return (
      <Link
        href={notification.link.href}
        onClick={handleSelect}
        aria-label={notificationAriaLabel(notification)}
        className={notificationRowClassName(notification.isRead)}
      >
        <NotificationBody notification={notification} />
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSelect}
      aria-label={notificationAriaLabel(notification)}
      className={notificationRowClassName(notification.isRead)}
    >
      <NotificationBody notification={notification} />
    </button>
  );
}
