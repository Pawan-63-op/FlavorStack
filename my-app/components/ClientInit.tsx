"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthExpired } from "@/lib/api/client/authEvents";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";

export default function ClientInit({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const initializeTheme = useThemeStore((s) => s.initializeTheme);

  useEffect(() => {
    initializeTheme();
    checkAuth();
  }, [checkAuth, initializeTheme]);

  // auth:expired clears the session (store-level subscriber); redirect to
  // login is the bootstrap's responsibility.
  useEffect(() => {
    return onAuthExpired(() => {
      router.replace("/login");
    });
  }, [router]);

  return <>{children} </>;
}
