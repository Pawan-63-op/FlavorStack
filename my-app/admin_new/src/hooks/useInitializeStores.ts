import { useEffect } from "react";
import { useRestaurantStore } from "../store/restaurantStore";
import { useMenuStore } from "../store/menuStore";
import { useCartStore } from "../store/cartStore";
import { useCouponStore } from "../store/couponStore";

/**
 * Custom hook to initialize all stores with data from the backend
 * Call this in your main App component or layout
 */
export function useInitializeStores() {
  const fetchRestaurants = useRestaurantStore((state) => state.fetchRestaurants);
  const fetchMenuItems = useMenuStore((state) => state.fetchMenuItems);
  const fetchOrders = useCartStore((state) => state.fetchOrders);
  const fetchCoupons = useCouponStore((state) => state.fetchCoupons);
  
  const isLoading = 
    useRestaurantStore((state) => state.isLoading) ||
    useMenuStore((state) => state.isLoading) ||
    useCartStore((state) => state.isLoading) ||
    useCouponStore((state) => state.isLoading);

  useEffect(() => {
    // Fetch all initial data in parallel
    Promise.all([
      fetchRestaurants(),
      fetchMenuItems(),
      fetchOrders(),
      fetchCoupons(),
    ]).catch((error) => {
      console.error("Error initializing stores:", error);
    });
  }, [fetchRestaurants, fetchMenuItems, fetchOrders, fetchCoupons]);

  return { isLoading };
}
