"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";

export default function ClientInit({
  children,
}: {
  children: React.ReactNode;
}) {
  // const { checkAuth } = useAuthStore();
  // const initializeTheme = useThemeStore((s) => s.initializeTheme);

  // useEffect(() => {
  //   initializeTheme();
  //   checkAuth();
  // }, [checkAuth, initializeTheme]);

  return <>{children} </>;
}
