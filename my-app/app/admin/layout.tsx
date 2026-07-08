"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { isEnabled } from "@/lib/config/featureFlags";
import { Loader2 } from "lucide-react";
import { Layout_comp } from "@/components/Layout_comp";

/**
 * Admin-console access guard. The console is gated at the PAGE level only on
 * authentication: any signed-in user may enter. What they can *do* is gated
 * per-tab inside `AdminDashboard` — admin-ops (Moderation/Fulfillments) by
 * `isAdmin`, the owner Queue by server-truth ownership (`/restaurants/mine`),
 * while the Restaurants tab stays open so a first-time owner can create their
 * restaurant (which is what makes them an owner). Gating ownership at the page
 * level previously locked out seeded/cross-device owners and created a
 * first-owner catch-22; that gate now lives where the data is, not on the door.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const adminEnabled = isEnabled("admin");

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  if (!adminEnabled) {
    return (
      <Layout_comp>
        <div className="min-h-[50vh] flex items-center justify-center">
          <p className="text-muted-foreground">The admin console is not available.</p>
        </div>
      </Layout_comp>
    );
  }

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

  // Block render while redirecting to prevent flash of protected content.
  if (!isAuthenticated) {
    return null;
  }

  return <Layout_comp>{children}</Layout_comp>;
}
