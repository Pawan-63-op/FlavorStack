import { create } from "zustand";
import { toast } from "sonner";

// Coupon interface
export interface Coupon {
  id: string;
  code: string;
  discount: number;
  type: "percentage" | "fixed" | "shipping";
  description: string;
  minOrder?: number;
  maxDiscount?: number;
  validUntil?: string;
  freeShipping?:boolean;
  isActive: boolean;
}
import axios from "axios";
// Store interface 
interface CouponState {
  coupons: Coupon[];
  appliedCoupon: Coupon | null;
  addCoupon: (couponData: Omit<Coupon, "id">) => void;
  updateCoupon: (id: string, couponData: Partial<Coupon>) => void;
  deleteCoupon: (id: string) => void;
  getCoupon: (code: string) => Coupon | undefined;
  validateCoupon: (code: string, orderTotal: number) => { valid: boolean; message: string; coupon?: Coupon };
  applyCoupon: (code: string, orderTotal: number) => boolean;
  removeAppliedCoupon: () => void;
  calculateDiscount: (orderTotal: number) => number;
  isLoading:boolean;
   error:string | null;
  fetchCoupons: () => Promise<void>;
}

// Default coupons
const defaultCoupons: Coupon[] = [
  {
    id: "1",
    code: "WELCOME10",
    discount: 10,
    type: "percentage",
    description: "10% off for new users",
    maxDiscount: 20,
    isActive: true
  },
  {
    id: "2",
    code: "SAVE5",
    discount: 5,
    type: "fixed",
    description: "$5 off on orders above $25",
    minOrder: 25,
    isActive: true
  },
  {
    id: "3",
    code: "FREESHIP",
    discount: 2.99,
    type: "shipping",
    description: "Free delivery",
    isActive: true
  }
];
const API_END_POINT = "http://localhost:8000/api/coupons";
// Zustand store
export const useCouponStore = create<CouponState>((set, get) => ({
  coupons: defaultCoupons,
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
  addCoupon: (couponData) => {
    const newCoupon: Coupon = { ...couponData, id: Date.now().toString() };
    set({ coupons: [...get().coupons, newCoupon] });
    toast.success(`Coupon "${couponData.code}" added!`);
  },

  updateCoupon: (id, couponData) => {
    set({
      coupons: get().coupons.map(c => c.id === id ? { ...c, ...couponData } : c)
    });
    toast.success("Coupon updated!");
  },

  deleteCoupon: (id) => {
    set({ coupons: get().coupons.filter(c => c.id !== id) });
    toast.info("Coupon deleted");
  },

  getCoupon: (code) => {
    return get().coupons.find(c => c.code.toUpperCase() === code.toUpperCase() && c.isActive);
  },

  validateCoupon: (code, orderTotal) => {
    const coupon = get().getCoupon(code);
    if (!coupon) return { valid: false, message: "Invalid coupon code" };
    if (!coupon.isActive) return { valid: false, message: "This coupon is no longer active" };
    if (coupon.validUntil && new Date(coupon.validUntil) < new Date()) return { valid: false, message: "This coupon has expired" };
    if (coupon.minOrder && orderTotal < coupon.minOrder) return { valid: false, message: `Order must be at least $${coupon.minOrder} to use this coupon` };
    return { valid: true, message: "Coupon applied successfully!", coupon };
  },

  applyCoupon: (code, orderTotal) => {
    const { valid, message, coupon } = get().validateCoupon(code, orderTotal);
    if (!valid) {
      toast.error(message);
      return false;
    }
    set({ appliedCoupon: coupon! });
    toast.success(`Coupon "${coupon!.code}" applied!`);
    return true;
  },

  removeAppliedCoupon: () => {
    set({ appliedCoupon: null });
    toast.info("Applied coupon removed");
  },

  calculateDiscount: (orderTotal) => {
    const coupon = get().appliedCoupon;
    if (!coupon) return 0;
    if (coupon.type === "percentage") {
      const discount = (orderTotal * coupon.discount) / 100;
      return coupon.maxDiscount ? Math.min(discount, coupon.maxDiscount) : discount;
    }
    return coupon.discount;
  }
}));
