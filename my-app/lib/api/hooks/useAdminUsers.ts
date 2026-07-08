"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminUserService, type ListUsersParams } from "../services/adminUsers";

/** Query key for the admin user list, scoped by its filter params (G6). */
export const adminUsersKey = (params: ListUsersParams) =>
  ["admin", "users", params] as const;

/**
 * Admin user browse (G6) — paginated `GET /admin/users`. `placeholderData` keeps the
 * previous page visible while the next loads (no flash to empty on page/filter change).
 */
export function useAdminUsers(params: ListUsersParams) {
  return useQuery({
    queryKey: adminUsersKey(params),
    queryFn: () => adminUserService.listUsers(params),
    placeholderData: (prev) => prev,
  });
}

/** Invalidate every admin-user list page after a moderation action. */
function useInvalidateUsers() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["admin", "users"] });
}

/** POST /admin/users/:id/role — change role, then refresh the list. */
export function useAssignRole() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      adminUserService.assignRole(userId, role),
    onSuccess: invalidate,
  });
}

/** POST /admin/users/:id/ban — ban with reason, then refresh the list. */
export function useBanUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      adminUserService.banUser(userId, reason),
    onSuccess: invalidate,
  });
}

/** POST /admin/users/:id/unban — lift ban, then refresh the list. */
export function useUnbanUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (userId: string) => adminUserService.unbanUser(userId),
    onSuccess: invalidate,
  });
}
