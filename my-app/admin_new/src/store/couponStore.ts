import { create } from "zustand";
import axios from "axios";
import { toast } from "sonner";

export interface Coupon {
  id: string;
  _id: string;
  code: string;
  discount: number;
  type: "percentage" | "fixed" | "shipping";
  description: string;
  minOrder?: number;
  maxDiscount?: number;
  isActive: boolean;
  expiresAt?: string;
  deadline?: string;
  freeShipping?: boolean;
}

interface CouponState {
  coupons: Coupon[];
  appliedCoupon: Coupon | null;
  isLoading: boolean;
  error: string | null;

  fetchCoupons: () => Promise<void>;
  addCoupon: (coupon: Omit<Coupon, "id">) => void;
  updateCoupon: (id: string, coupon: Partial<Coupon>) => void;
  deleteCoupon: (id: string) => void;
  toggleCoupon: (id: string, isActive: boolean) => Promise<void>;

  applyCoupon: (code: string, orderTotal?: number) => boolean;
  removeAppliedCoupon: () => void;
  removeCoupon: () => void;
  validateCoupon: (code: string, orderTotal: number) => { valid: boolean; message: string; coupon?: Coupon };
  calculateDiscount: (orderTotal: number) => number;
}

const API_END_POINT = "http://localhost:8000/api/coupons";
axios.defaults.withCredentials = true;

export const useCouponStore = create<CouponState>((set, get) => ({
  coupons: [],
  appliedCoupon: null,
  isLoading: false,
  error: null,

  fetchCoupons: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await axios.get(`${API_END_POINT}/`);
      const raw = data.coupons || data || [];
      const mapped: Coupon[] = raw.map((c: any) => ({
        id:          c._id || c.id,
        _id:         c._id || c.id,
        code:        c.code,
        discount:    c.discount,
        type:        c.type,
        description: c.description || "",
        minOrder:    c.minOrder,
        maxDiscount: c.maxDiscount,
        isActive:    c.isActive,
        expiresAt:   c.expiresAt || c.deadline,
        deadline:    c.deadline || c.expiresAt,
        freeShipping: c.freeShipping || c.type === "shipping",
      }));
      set({ coupons: mapped, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      console.error("Error fetching coupons:", error);
    }
  },

  validateCoupon: (code, orderTotal) => {
    const coupon = get().coupons.find(
      (c) => c.code.toUpperCase() === code.toUpperCase() && c.isActive
    );
    if (!(coupon?.isActive)) return { valid: false, message: "Coupon is no longer active" };
    if (!coupon) return { valid: false, message: "Invalid  coupon code" };

    const expiry = coupon.expiresAt || coupon.deadline;
    if (expiry && new Date(expiry) < new Date())
      return { valid: false, message: "This coupon has expired" };
    if (coupon.minOrder && orderTotal < coupon.minOrder)
      return { valid: false, message: `Minimum order of $${coupon.minOrder} required` };

    return { valid: true, message: "Coupon applied!", coupon };
  },

  applyCoupon: (code, orderTotal = 0) => {
    const { valid, message, coupon } = get().validateCoupon(code, orderTotal);
    if (!valid) { toast.error(message); return false; }
    set({ appliedCoupon: coupon! });
    toast.success(`Coupon "${coupon!.code}" applied!`);
    return true;
  },

  removeAppliedCoupon: () => { set({ appliedCoupon: null }); toast.info("Coupon removed"); },
  removeCoupon: () => { set({ appliedCoupon: null }); },

  calculateDiscount: (orderTotal) => {
    const coupon = get().appliedCoupon;
    if (!coupon) return 0;
    if (coupon.freeShipping || coupon.type === "shipping") return 0;
    if (coupon.type === "percentage") {
      const disc = (orderTotal * coupon.discount) / 100;
      return coupon.maxDiscount ? Math.min(disc, coupon.maxDiscount) : disc;
    }
    return coupon.discount;
  },

  addCoupon: (coupon) => {
    const newCoupon: Coupon = { ...coupon, id: `coupon-${Date.now()}`, _id: "" };
    set((s) => ({ coupons: [...s.coupons, newCoupon] }));
    axios.post(`${API_END_POINT}/`, newCoupon)
      .then(() => get().fetchCoupons())
      .catch((e) => console.error("Error creating coupon:", e));
  },

  updateCoupon: (id, coupon) => {
    set((s) => ({
      coupons: s.coupons.map((c) => (c._id === id ? { ...c, ...coupon } : c)),
    }));
    axios.patch(`${API_END_POINT}/${id}`, coupon)
      .catch((e) => console.error("Error updating coupon:", e));
  },

  deleteCoupon: async (id) => {
    await axios.delete(`${API_END_POINT}/${id}`);
    set((s) => ({ coupons: s.coupons.filter((c) => c._id !== id) }));
  },

  toggleCoupon: async (id, isActive) => {
    const res = await axios.patch(`${API_END_POINT}/${id}/toggle`, { isActive });
    set((s) => ({
      coupons: s.coupons.map((c) =>
        c._id === id ? { ...c, isActive: res.data.isActive } : c
      ),
    }));
  },
}));