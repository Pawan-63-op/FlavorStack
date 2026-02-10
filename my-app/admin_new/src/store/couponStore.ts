import { create } from "zustand";
import axios from "axios";

export interface Coupon {
  id: string;
  _id:string;
  code: string;
  discount: number;
  type: "percentage" | "fixed" | "shipping";
  description: string;
  minOrder?: number;
  maxDiscount?: number;
  isActive: boolean;
  expiresAt?: string;
}
interface CouponState {
  coupons: Coupon[];
  appliedCoupon: Coupon | null;
  isLoading: boolean;
  error: string | null;
  fetchCoupons: () => Promise<void>;
  addCoupon: (coupon: Omit<Coupon, "id">) => void;
  updateCoupon: (id: string, coupon: Partial<Coupon>) => void;
   toggleCoupon :(id:string,isActive:boolean) => Promise<void>;
  deleteCoupon:  (id: string) => void;
  applyCoupon: (code: string) => boolean;
  removeCoupon: () => void;
  validateCoupon: (code: string, orderTotal: number) => boolean;
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
      const couponsArray = data.coupons || [];
      set({ coupons:couponsArray, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      console.error("Error fetching coupons:", error);
    }
  },

  addCoupon: (coupon) => {
    const newCoupon: Coupon = {
      ...coupon,
      id: `coupon-${Date.now()}`,
    };
    set((state) => ({
      coupons: [...state.coupons, newCoupon],
    }));

    // In a real app, sync with backend
    axios.post(`${API_END_POINT}/`, newCoupon).catch((error) => {
      console.error("Error creating coupon:", error);
    });
      get().fetchCoupons();
  },


  updateCoupon: (id, coupon) => {
    set((state) => ({
      coupons: state.coupons.map((c) => (c._id === id ? { ...c, ...coupon } : c)),
    }));

    // In a real app, sync with backend
    axios.patch(`${API_END_POINT}/${id}`, coupon).catch((error) => {
      console.error("Error updating coupon:", error);
    });
    //  get().fetchCoupons();
  },

  deleteCoupon : async(id) => {
    await axios.delete(`${API_END_POINT}/${id}`);
set((state) => ({
 coupons: state.coupons.filter((coupon) => coupon._id !== id),
}));
  },
 toggleCoupon: async (id, isActive) => {
    const res = await axios.patch(`${API_END_POINT}/${id}/toggle`, { isActive });
    set((state) => ({
      coupons: state.coupons.map((c) =>
        c._id === id ? { ...c, isActive: res.data.isActive } : c
      ),
    }));
  },
  applyCoupon: (code) => {
    const coupon = get().coupons.find(
      (c) => c.code === code.toUpperCase() && c.isActive
    );

    if (coupon) {
      set({ appliedCoupon: coupon });
      return true;
    }
    return false;
  },

  removeCoupon: () => {
    set({ appliedCoupon: null });
  },

  validateCoupon: (code, orderTotal) => {
    const coupon = get().coupons.find(
      (c) => c.code === code.toUpperCase() && c.isActive
    );

    if (!coupon) return false;

    if (coupon.minOrder && orderTotal < coupon.minOrder) {
      return false;
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return false;
    }

    return true;
  },
}));
