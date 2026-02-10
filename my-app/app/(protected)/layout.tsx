"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Loader2 } from "lucide-react";
import { Layout_comp } from "@/components/Layout_comp";

// required if you use hooks, zustand, router, etc.

export default function Layout({ children }: { children: React.ReactNode }) {
  // const router = useRouter();
  // const pathname = usePathname();

  // const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // const isLoading = useAuthStore((state) => state.isLoading);
  // const user = useAuthStore((state) => state.user);

  // // 🔁 Handle redirects
  // useEffect(() => {
  //   if (isLoading) return;

  //   if (!isAuthenticated) {
  //    router.replace("/login");
  //     // router.replace(`/login?from=${encodeURIComponent(pathname)}`);
  //     return;
  //   }

  //   if (!user?.isVerified) {
  //     router.replace("/verify-email");
  //   }
  // }, [isAuthenticated, isLoading, user, pathname, router]);

  // ⏳ Loading state
  // if (isLoading) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center bg-accent/30">
  //       <div className="flex flex-col items-center gap-4">
  //         <Loader2 className="h-8 w-8 animate-spin text-primary" />
  //         <p className="text-muted-foreground">Loading...</p>
  //       </div>
  //     </div>
  //   );
  // }

  // 🚫 Block render while redirecting
  // if (!isAuthenticated || !user?.isVerified) {
  //   return null;
  // }

  return (
    <>
      <Layout_comp>{children}</Layout_comp>
    </>
  );
}
