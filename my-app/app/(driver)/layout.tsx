"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { landingPathForRole } from "@/lib/auth/roleLanding";
import { Loader2 } from "lucide-react";

/**
 * Phase 14.1 — driver route-group guard (scaffold for the Phase 14.4 driver
 * surface). Requires an authenticated, verified user whose JWT `role` is
 * DRIVER; everyone else is bounced to their own landing destination.
 *
 * Real authorization is still enforced server-side via the `role` claim — this
 * guard only prevents non-drivers from seeing an empty/forbidden driver screen.
 */
export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);

  const isDriver = user?.role === "DRIVER";

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
      return;
    }
    if (user && user.isVerified === false) {
      router.replace("/verify-email");
      return;
    }
    if (!isDriver) {
      // Send non-drivers to their own landing surface.
      router.replace(user ? landingPathForRole(user.role) : "/");
    }
  }, [isAuthenticated, isLoading, isDriver, user, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-accent/30">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Block render while redirecting to prevent flash of the driver surface.
  if (!isAuthenticated || user?.isVerified === false || !isDriver) {
    return null;
  }

  return <>{children}</>;
}
