"use client";

import { useEffect } from "react";
import { useAddressStore } from "@/store/addressStore";
import { useAuthStore } from "@/store/authStore";

/**
 * Pulls the signed-in customer's server-truth addresses into the address store
 * (Phase 15 / G12). Call it from any surface that reads addresses (address book,
 * checkout, home). When authenticated it fetches once per auth transition; when
 * logged out it drops the cached list so a different user never sees stale
 * addresses. The store dedupes concurrent fetches via its `loading` flag.
 */
export function useHydrateAddresses(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
  const hydrate = useAddressStore((s) => s.hydrate);
  const clear = useAddressStore((s) => s.clear);

  useEffect(() => {
    if (isAuthenticated) {
      void hydrate();
    } else {
      clear();
    }
  }, [isAuthenticated, userId, hydrate, clear]);
}
