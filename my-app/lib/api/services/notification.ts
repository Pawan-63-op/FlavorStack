import { notificationAdapter, type NotificationResponse, type NotificationView } from "../adapters/notification";
import {
  notificationPreferencesAdapter,
  type NotificationPreferenceResponse,
  type NotificationPreferencesView,
  type PreferenceChange,
} from "../adapters/notificationPreferences";
import { client } from "../client/http";

/**
 * Notification service — notifications center over the composed API client
 * (Batch 8.1). Mapping source: `my-app/integration_phases/Phase_8.md`
 * (frozen server_2 `/me/notifications*` contract).
 *
 * The list endpoint returns a **bare `NotificationResponse[]`** (no wrapper, no
 * total, no cursor) with **offset** pagination, so `hasMore` is derived from the
 * page length — a full page (`length === limit`) is assumed to have more. This
 * can produce one empty final "load more" (documented limitation).
 */

export interface ListNotificationsParams {
  limit?: number;
  offset?: number;
}

export interface NotificationsPage {
  items: NotificationView[];
  hasMore: boolean;
}

const DEFAULT_LIMIT = 20;

/** Builds a `?limit=&offset=` query string for the bare-array list endpoint. */
function buildListQuery(limit: number, offset: number): string {
  const search = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return `?${search.toString()}`;
}

class NotificationService {
  /** Composed transport (single-flight 401→refresh applied). */
  private readonly http = client;

  /** GET /me/notifications?limit&offset → notificationAdapter per item; length-derived `hasMore`. */
  async listNotifications(params: ListNotificationsParams = {}): Promise<NotificationsPage> {
    const { limit = DEFAULT_LIMIT, offset = 0 } = params;
    const dtos = await this.http.get<NotificationResponse[]>(
      `/me/notifications${buildListQuery(limit, offset)}`,
    );
    const items = dtos.map(notificationAdapter);
    return { items, hasMore: items.length === limit };
  }

  /** GET /me/notifications/unread-count → the bare count. */
  async getUnreadCount(): Promise<number> {
    const res = await this.http.get<{ count: number }>("/me/notifications/unread-count");
    return res.count;
  }

  /** PATCH /me/notifications/:id/read — mark one read (no mark-all-read endpoint exists). */
  async markRead(id: string): Promise<void> {
    await this.http.patch<void>(`/me/notifications/${id}/read`, {});
  }

  /** GET /me/notification-preferences → adapted view (server applies default-allow). */
  async getPreferences(): Promise<NotificationPreferencesView> {
    const dto = await this.http.get<NotificationPreferenceResponse>(
      "/me/notification-preferences",
    );
    return notificationPreferencesAdapter(dto);
  }

  /** PUT /me/notification-preferences with a diff body `{ changes }` (≥1 entry). */
  async updatePreferences(changes: PreferenceChange[]): Promise<NotificationPreferencesView> {
    const dto = await this.http.put<NotificationPreferenceResponse>(
      "/me/notification-preferences",
      { body: { changes } },
    );
    return notificationPreferencesAdapter(dto);
  }
}

export const notificationService = new NotificationService();
