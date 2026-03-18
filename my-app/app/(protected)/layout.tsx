"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Loader2 } from "lucide-react";
import { Layout_comp } from "@/components/Layout_comp";

export default function Layout({ children }: { children: React.ReactNode }) {
  const router          = useRouter();
  const pathname        = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading       = useAuthStore((s) => s.isLoading);
  const user            = useAuthStore((s) => s.user);
  const checkAuth       = useAuthStore((s) => s.checkAuth);

  // Run checkAuth once on mount to restore session from cookie
  useEffect(() => {
    checkAuth();
  }, []);

  // FIX: restored auth guard — was fully commented out
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      // Preserve intended destination for post-login redirect
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
      return;
    }

    if (user && user.isVerified === false) {
      router.replace("/verify-email");
    }
  }, [isAuthenticated, isLoading, user, pathname, router]);

  // Show spinner while checking auth
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

  // Block render while redirecting to prevent flash of protected content
  if (!isAuthenticated || user?.isVerified === false) {
    return null;
  }

  return <Layout_comp>{children}</Layout_comp>;
}
