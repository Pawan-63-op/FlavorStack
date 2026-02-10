import { create } from "zustand";
import { toast } from "sonner";

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
  cart: CartItem[];
  orders: Order[];
  // addToCart: (item: Omit<CartItem, "quantity">) => void;
   addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
  checkout: (restaurantName: string) => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  cart: [],
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

  // addToCart: (item) =>
  //   set((state) => {
  //     const existingItem = state.cart.find((i) => i.id === item.id);
  //     if (existingItem) {
  //       toast.success("Quantity updated in cart!");
  //       return {
  //         cart: state.cart.map((i) =>
  //           i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
  //         ),
  //       };
  //     }
  //     toast.success(`${item.name} added to cart!`);
  //     return { cart: [...state.cart, { ...item, quantity: 1 }] };
  //   }),


addToCart: (item) =>
  set((state) => {
    const existingItem = state.cart.find((i) => i.id === item.id);
    const qtyToAdd = item.quantity ??1 ; // user-selected quantity (default 1)

    if (existingItem) {
      const updatedCart = state.cart.map((i) =>
        i.id === item.id
          ? { ...i, quantity: i.quantity + qtyToAdd }
          : i
      );

      toast.success(`${item.name} × ${qtyToAdd} added to cart!`);
      return { cart: updatedCart };
    }

    toast.success(`${item.name} × ${qtyToAdd} added to cart!`);
    return {
      cart: [...state.cart, { ...item, quantity: qtyToAdd }],
    };
  }),

  removeFromCart: (id) =>
    set((state) => {
      toast.success("Item removed from cart");
      return { cart: state.cart.filter((item) => item.id !== id) };
    }),

  updateQuantity: (id, quantity) =>
    set((state) => {
      if (quantity <= 0) {
        toast.success("Item removed from cart");
        return { cart: state.cart.filter((item) => item.id !== id) };
      }
      return {
        cart: state.cart.map((item) =>
          item.id === id ? { ...item, quantity } : item
        ),
      };
    }),

  clearCart: () => set({ cart: [] }),

  getCartTotal: () => {
    const { cart } = get();
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  },

  getCartCount: () => {
    const { cart } = get();
    return cart.reduce((count, item) => count + item.quantity, 0);
  },

  checkout: (restaurantName) =>
    set((state) => {
      const newOrder: Order = {
        id: `ORD-${String(state.orders.length + 1).padStart(3, "0")}`,
        date: "Just now",
        timestamp: Date.now(),
        restaurantName,
        items: [...state.cart],
        total: get().getCartTotal(),
        status: "pending",
      };
      toast.success("Order placed successfully!");
      return {
        orders: [newOrder, ...state.orders],
        cart: [],
      };
    }),
}));
