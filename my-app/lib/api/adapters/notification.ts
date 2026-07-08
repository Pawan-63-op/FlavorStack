import { formatRelativeTime } from "../format/date";

/**
 * server_2 engagement notification DTO → app notification view-model.
 *
 * Mapping source: `my-app/integration_phases/Phase_8.md` (frozen server_2
 * `/me/notifications*` contract,
 * `server_2/src/application/engagement/responses/NotificationResponse.ts`).
 *
 * Read-state is derived from `status === 'READ'` (statuses:
 * `PENDING|SENT|FAILED|READ`) — there is no boolean `isRead` on the wire.
 *
 * **Deep-link gap (documented):** notifications carry no structured payload /
 * `data` field. `fulfillmentId` is injected only as a template variable at
 * dispatch and rendered into the body text (e.g. the seeded `order_confirmed`
 * template `"Your order {{fulfillmentId}} has been confirmed..."`). So linking a
 * notification back to the Phase 7 tracking surface is **best-effort**: we map
 * by `category`/`templateKey` to know it is order/delivery related, then regex a
 * fulfillment id (UUID) out of the body. Wording changes break the regex.
 */

export type NotificationCategory =
  | "ORDER_UPDATES"
  | "DELIVERY"
  | "SECURITY"
  | "PROMOTIONS";

export type NotificationChannel = "PUSH" | "EMAIL";

export type NotificationStatus = "PENDING" | "SENT" | "FAILED" | "READ";

/** Badge variant names (shadcn `Badge`) the UI layer (Batch 8.2) consumes. */
export type NotificationVariant = "default" | "secondary" | "destructive" | "outline";

export interface NotificationResponse {
  notificationId: string;
  recipientUserId: string;
  category: string;
  channel: string;
  templateKey: string;
  title: string;
  body: string;
  status: string;
  provider?: string | null;
  createdAt: string;
  sentAt?: string;
  failedReason?: string;
  readAt?: string;
}

/** A resolved best-effort deep-link into the Phase 7 tracking surface. */
export interface NotificationLink {
  href: string;
}

export interface NotificationView {
  id: string;
  category: string;
  title: string;
  body: string;
  templateKey: string;
  createdAt: string;
  readAt: string | null;
  /** `true` once the server marks the notification `READ`. */
  isRead: boolean;
  /** Relative ("2 hours ago") rendering of `createdAt`. */
  formattedTime: string;
  /** Lucide icon name for the category, consumed by the UI layer. */
  icon: string;
  /** Badge variant for the category. */
  variant: NotificationVariant;
  /** Best-effort tracking deep-link, or `null` when none can be derived. */
  link: NotificationLink | null;
}

/** Category → presentation mapping. Centralized so the UI stays declarative. */
const CATEGORY_PRESENTATION: Record<string, { icon: string; variant: NotificationVariant }> = {
  ORDER_UPDATES: { icon: "package", variant: "default" },
  DELIVERY: { icon: "truck", variant: "default" },
  SECURITY: { icon: "shield", variant: "destructive" },
  PROMOTIONS: { icon: "tag", variant: "secondary" },
};

const DEFAULT_PRESENTATION = { icon: "bell", variant: "outline" } as const;

function categoryPresentation(category: string): { icon: string; variant: NotificationVariant } {
  return CATEGORY_PRESENTATION[category] ?? DEFAULT_PRESENTATION;
}

/**
 * Categories whose notifications relate to an order/fulfillment and may carry a
 * trackable id. Centralized template→intent map (Phase_8.md Batch 8.1, task 2).
 */
const TRACKING_CATEGORIES: ReadonlySet<string> = new Set(["ORDER_UPDATES", "DELIVERY"]);

/** Known order/delivery template keys that embed a `fulfillmentId` in the body. */
const TRACKING_TEMPLATE_KEYS: ReadonlySet<string> = new Set([
  "order_confirmed",
  "rider_assigned",
  "delivered",
]);

/** UUID token as rendered into the body by the server's template variables. */
const FULFILLMENT_ID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Best-effort deep-link extractor. Returns a link to the Phase 7 tracking
 * surface when the notification is order/delivery related AND a fulfillment id
 * can be parsed from the rendered body; otherwise `null`.
 *
 * The tracking surface (`/order-processing`) resolves a fulfillment from the
 * locally tracked orders; we pass the parsed id via `fulfillmentId` so the UI
 * layer (Batch 8.2) can route to it. Because no structured id exists, this is
 * inherently unreliable for re-worded templates — documented as a server_2 gap.
 */
export function extractNotificationLink(dto: NotificationResponse): NotificationLink | null {
  const isTrackingRelated =
    TRACKING_CATEGORIES.has(dto.category) || TRACKING_TEMPLATE_KEYS.has(dto.templateKey);
  if (!isTrackingRelated) return null;

  const match = dto.body.match(FULFILLMENT_ID_PATTERN);
  if (!match) return null;

  return { href: `/order-processing?fulfillmentId=${encodeURIComponent(match[0])}` };
}

/**
 * Pure DTO→view-model map. Single-argument so it is safe to use directly with
 * `Array.prototype.map`. Relative time is computed against "now" at call time;
 * tests pin the clock.
 */
export function notificationAdapter(dto: NotificationResponse): NotificationView {
  const presentation = categoryPresentation(dto.category);
  return {
    id: dto.notificationId,
    category: dto.category,
    title: dto.title,
    body: dto.body,
    templateKey: dto.templateKey,
    createdAt: dto.createdAt,
    readAt: dto.readAt ?? null,
    isRead: dto.status === "READ",
    formattedTime: formatRelativeTime(dto.createdAt),
    icon: presentation.icon,
    variant: presentation.variant,
    link: extractNotificationLink(dto),
  };
}
