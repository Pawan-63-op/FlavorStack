"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminDriverService } from "../services/adminDrivers";

/** Query key for the admin driver list, scoped by optional status filter. */
export const adminDriversKey = (status?: string) => ["admin", "drivers", status ?? "all"] as const;

/**
 * Admin driver list (G5) — loads the verification queue (or all drivers when
 * `status` is omitted) from `GET /admin/drivers`. Replaces the paste-a-userId UX.
 */
export function useAdminDrivers(status?: string) {
  return useQuery({
    queryKey: adminDriversKey(status),
    queryFn: () => adminDriverService.listDrivers(status),
  });
}

/**
 * Admin "verify driver" mutation (Phase 14.3) — thin TanStack wrapper over
 * `adminDriverService`. On success it invalidates the driver list so the verified
 * driver drops out of the pending queue without a manual refresh.
 */
export function useVerifyDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (driverId: string) => adminDriverService.verifyDriver(driverId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "drivers"] });
    },
  });
}
