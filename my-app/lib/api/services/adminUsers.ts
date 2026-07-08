import { client } from "../client/http";

/**
 * Admin user-management service (Phase 15 / G6) — ADMIN-only browse + moderate over
 * the composed API client. Reads `GET /admin/users` (paginated) and drives the
 * existing role/ban/unban endpoints. Server-side everything is guarded by
 * `requireRole(ADMIN)` + `requirePermission(USER, …)`; the UI hides the tab behind
 * `user.isAdmin` only as a UX mitigation, not a security control.
 */
export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isBanned: boolean;
  banReason: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  driverStatus: string | null;
  createdAt: string;
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  role?: string;
  search?: string;
}

export interface ListUsersResult {
  users: AdminUserSummary[];
  total: number;
  limit: number;
  offset: number;
}

class AdminUserService {
  private readonly http = client;

  /** GET /admin/users[?page&limit&role&search] — paginated user browse (G6). */
  async listUsers(params: ListUsersParams = {}): Promise<ListUsersResult> {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.role) qs.set("role", params.role);
    if (params.search && params.search.trim()) qs.set("search", params.search.trim());
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.http.get<ListUsersResult>(`/admin/users${suffix}`);
  }

  /** POST /admin/users/:id/role — change a user's role (204). */
  async assignRole(userId: string, role: string): Promise<void> {
    await this.http.post<void>(`/admin/users/${userId}/role`, { body: { role } });
  }

  /** POST /admin/users/:id/ban — ban a user with a reason (204, revokes sessions). */
  async banUser(userId: string, reason: string): Promise<void> {
    await this.http.post<void>(`/admin/users/${userId}/ban`, { body: { reason } });
  }

  /** POST /admin/users/:id/unban — lift a ban (204). */
  async unbanUser(userId: string): Promise<void> {
    await this.http.post<void>(`/admin/users/${userId}/unban`, { body: {} });
  }
}

export const adminUserService = new AdminUserService();
