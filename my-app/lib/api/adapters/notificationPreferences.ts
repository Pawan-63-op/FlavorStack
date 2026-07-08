import type { NotificationCategory, NotificationChannel } from "./notification";

/**
 * server_2 notification-preferences DTO → app view-model + diff helper.
 *
 * Mapping source: `my-app/integration_phases/Phase_8.md` (frozen server_2
 * `/me/notification-preferences` contract,
 * `server_2/src/application/engagement/responses/NotificationPreferenceResponse.ts`).
 *
 * The server returns a **fully-populated** `channels` map (its default-allow
 * rule — every category on both channels except PROMOTIONS email — is applied
 * server-side), so the FE renders the returned values verbatim. Writes are a
 * **diff**: `PUT` expects `{ changes: [{category, channel, enabled}] }` with
 * ≥1 entry, so {@link diffPreferences} emits only the toggles that changed.
 */

export interface ChannelToggleResponse {
  push: boolean;
  email: boolean;
}

export interface NotificationPreferenceResponse {
  userId: string;
  channels: Record<NotificationCategory, ChannelToggleResponse>;
  updatedAt: string;
}

/** A single toggle change in the shape the server's diff `PUT` expects. */
export interface PreferenceChange {
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
}

/** The editable per-category × per-channel state the screen holds. */
export type PreferenceChannelMap = Record<NotificationCategory, ChannelToggleResponse>;

/** One render-ready row in the preferences grid. */
export interface PreferenceRow {
  category: NotificationCategory;
  label: string;
  push: boolean;
  email: boolean;
}

export interface NotificationPreferencesView {
  userId: string;
  /** Rows in a stable display order, regardless of server key order. */
  rows: PreferenceRow[];
  /** The same data keyed for editing/diffing. */
  channels: PreferenceChannelMap;
  updatedAt: string;
}

/** Stable display order + labels for the four categories. */
export const PREFERENCE_CATEGORIES: { category: NotificationCategory; label: string }[] = [
  { category: "ORDER_UPDATES", label: "Order updates" },
  { category: "DELIVERY", label: "Delivery" },
  { category: "SECURITY", label: "Security" },
  { category: "PROMOTIONS", label: "Promotions" },
];

function toggleFor(
  channels: Record<NotificationCategory, ChannelToggleResponse>,
  category: NotificationCategory,
): ChannelToggleResponse {
  return channels[category] ?? { push: false, email: false };
}

export function notificationPreferencesAdapter(
  dto: NotificationPreferenceResponse,
): NotificationPreferencesView {
  const channels = {} as PreferenceChannelMap;
  const rows: PreferenceRow[] = PREFERENCE_CATEGORIES.map(({ category, label }) => {
    const toggle = toggleFor(dto.channels, category);
    channels[category] = { push: toggle.push, email: toggle.email };
    return { category, label, push: toggle.push, email: toggle.email };
  });

  return { userId: dto.userId, rows, channels, updatedAt: dto.updatedAt };
}

/**
 * Emit the minimal set of changes to go from `prev` to `next` (current →
 * desired). Unchanged toggles produce no entry, so an unmodified form yields an
 * empty array — the caller must guard the `PUT` (server rejects `< 1` change).
 */
export function diffPreferences(
  prev: PreferenceChannelMap,
  next: PreferenceChannelMap,
): PreferenceChange[] {
  const changes: PreferenceChange[] = [];
  for (const { category } of PREFERENCE_CATEGORIES) {
    const before = prev[category];
    const after = next[category];
    if (!before || !after) continue;
    if (before.push !== after.push) {
      changes.push({ category, channel: "PUSH", enabled: after.push });
    }
    if (before.email !== after.email) {
      changes.push({ category, channel: "EMAIL", enabled: after.email });
    }
  }
  return changes;
}
