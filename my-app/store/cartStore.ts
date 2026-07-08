import { create } from "zustand";

/**
 * Cart lines, quantities, totals and checkout are now owned by the server cart
 * (Batch 5.2) — see `lib/api/hooks/useCart.ts` / `lib/api/services/cart.ts`.
 * The local cart array and its total math were removed here; the only state
 * retained is the mock `orders` list, a Phase 6/7 placeholder (client-tracked
 * order history lands in Phase 7) left untouched so nothing downstream breaks.
 */
export interface CartItem {
  id: string;
  restaurantId?: number;
  restaurantName: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export interface Order {
  id: string;
  date: string;
  timestamp: number;
  restaurantName: string;
  items: CartItem[];
  total: number;
  status: "pending" | "confirmed" | "preparing" | "Delivered" | "cancelled";
}

interface CartState {
  orders: Order[];
}

export const useCartStore = create<CartState>(() => ({
  orders: [
    {
      id: "ORD-001",
      date: "2 days ago",
      timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
      restaurantName: "La Bella Italia",
      items: [
        {
          id: "1",
          restaurantId: 1,
          restaurantName: "La Bella Italia",
          name: "Margherita Pizza",
          price: 16.99,
          quantity: 2,
          image: "",
        },
      ],
      total: 33.98,
      status: "Delivered",
    },
    {
      id: "ORD-002",
      date: "5 days ago",
      timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000,
      restaurantName: "Tokyo Sushi Bar",
      items: [
        {
          id: "2",
          restaurantId: 2,
          restaurantName: "Tokyo Sushi Bar",
          name: "Premium Sushi Platter",
          price: 28.99,
          quantity: 1,
          image: "",
        },
      ],
      total: 28.99,
      status: "Delivered",
    },
  ],
}));
