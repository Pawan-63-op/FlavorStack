import type { UserRole } from "@/lib/api/adapters/user";

/**
 * Phase 14.1 — centralised post-login / landing destination by JWT `role`.
 *
 * - DRIVER → `/driver` (driver operational surface, Phase 14.4)
 * - ADMIN  → `/admin`  (platform-admin / owner console)
 * - CUSTOMER → `/`      (Home)
 *
 * Owners are CUSTOMERs (a CUSTOMER who owns ≥1 restaurant); their elevated
 * `/admin` access is granted by the admin layout's ownership guard, not by the
 * role claim, so they land on Home here and navigate to the console.
 */
export function landingPathForRole(role: UserRole): string {
  switch (role) {
    case "DRIVER":
      return "/driver";
    case "ADMIN":
      return "/admin";
    case "CUSTOMER":
    default:
      return "/";
  }
}
