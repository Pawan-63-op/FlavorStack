import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import type { Address } from "@/lib/address/types";
import { addressService } from "@/lib/api/services/address";

export type { Address };

/**
 * Server-backed address book (Phase 15 / G12). Addresses now live on the
 * Customer aggregate server-side (`GET/POST/PATCH/DELETE /users/me/addresses`),
 * so a fresh browser/device can still check out. localStorage remains only a
 * cache: `hydrate()` fetches server truth and every mutation replaces the local
 * list with the server's returned list (which flags the default). This mirrors
 * the owner registry-as-cache pattern (`useOwnerRestaurants`).
 */
interface AddressState {
  addresses: Address[];
  hydrated: boolean;
  loading: boolean;
  hydrate: () => Promise<void>;
  clear: () => void;
  addAddress: (data: Omit<Address, "id">) => Promise<void>;
  updateAddress: (id: string, data: Omit<Address, "id">) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;
  setDefault: (id: string) => Promise<void>;
  getDefault: () => Address | undefined;
}

export const useAddressStore = create<AddressState>()(
  persist(
    (set, get) => ({
      addresses: [],
      hydrated: false,
      loading: false,

      hydrate: async () => {
        if (get().loading) return;
        set({ loading: true });
        try {
          const addresses = await addressService.list();
          set({ addresses, hydrated: true });
        } catch {
        } finally {
          set({ loading: false });
        }
      },

      clear: () => set({ addresses: [], hydrated: false }),

      addAddress: async (data) => {
        try {
          const addresses = await addressService.create(data);
          set({ addresses });
          toast.success(`"${data.label}" address saved!`);
        } catch {
          toast.error("Couldn't save the address. Please try again.");
        }
      },

      updateAddress: async (id, data) => {
        try {
          const addresses = await addressService.update(id, data);
          set({ addresses });
          toast.success("Address updated!");
        } catch {
          toast.error("Couldn't update the address. Please try again.");
        }
      },

      deleteAddress: async (id) => {
        try {
          const addresses = await addressService.remove(id);
          set({ addresses });
          toast.success("Address removed");
        } catch {
          toast.error("Couldn't remove the address. Please try again.");
        }
      },

      setDefault: async (id) => {
        try {
          const addresses = await addressService.setDefault(id);
          set({ addresses });
          toast.success("Default address updated");
        } catch {
          toast.error("Couldn't update the default address. Please try again.");
        }
      },

      getDefault: () => get().addresses.find((a) => a.isDefault),
    }),
    {
      name: "address-book-storage",
      partialize: (state) => ({ addresses: state.addresses }),
    },
  ),
);
