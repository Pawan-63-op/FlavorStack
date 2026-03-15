import { create } from "zustand";
import { toast } from "sonner";

const BASE = "http://localhost:8000/api/addresses";

export interface Address {
  _id: string;
  label: string;
  name: string;
  phone: string;
  address: string;
  isDefault: boolean;
}

interface AddressState {
  addresses: Address[];
  isLoading: boolean;

  fetchAddresses: () => Promise<void>;
  addAddress: (data: Omit<Address, "_id">) => Promise<void>;
  updateAddress: (id: string, data: Partial<Address>) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;
  setDefault: (id: string) => Promise<void>;
  getDefault: () => Address | undefined;
}

export const useAddressStore = create<AddressState>((set, get) => ({
  addresses: [],
  isLoading: false,

  fetchAddresses: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch(BASE, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch addresses");
      const data = await res.json();
      set({ addresses: data.addresses || [], isLoading: false });
    } catch (err) {
      console.error("fetchAddresses:", err);
      set({ isLoading: false });
    }
  },

  addAddress: async (data) => {
    try {
      const res = await fetch(BASE, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      const result = await res.json();
      // If new address is default, unset all others locally
      set((s) => ({
        addresses: [
          ...(data.isDefault
            ? s.addresses.map((a) => ({ ...a, isDefault: false }))
            : s.addresses),
          result.address,
        ],
      }));
      toast.success(`"${data.label}" address saved!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to save address");
    }
  },

  updateAddress: async (id, data) => {
    try {
      const res = await fetch(`${BASE}/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      const result = await res.json();
      set((s) => ({
        addresses: s.addresses.map((a) =>
          a._id === id
            ? result.address
            : data.isDefault
            ? { ...a, isDefault: false }
            : a
        ),
      }));
      toast.success("Address updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update address");
    }
  },

  deleteAddress: async (id) => {
    const { addresses } = get();
    const wasDefault = addresses.find((a) => a._id === id)?.isDefault;
    // Optimistic update
    const remaining = addresses.filter((a) => a._id !== id);
    if (wasDefault && remaining.length > 0) remaining[0].isDefault = true;
    set({ addresses: remaining });

    try {
      const res = await fetch(`${BASE}/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Address removed");
    } catch (err: any) {
      // Roll back
      set({ addresses });
      toast.error(err.message || "Failed to delete address");
    }
  },

  setDefault: async (id) => {
    // Optimistic update
    set((s) => ({
      addresses: s.addresses.map((a) => ({ ...a, isDefault: a._id === id })),
    }));
    try {
      const res = await fetch(`${BASE}/${id}/set-default`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to set default");
      toast.success("Default address updated");
    } catch (err: any) {
      // Re-fetch to restore correct state
      get().fetchAddresses();
      toast.error(err.message || "Failed to set default");
    }
  },

  getDefault: () => get().addresses.find((a) => a.isDefault),
}));
