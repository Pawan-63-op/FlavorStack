import { create } from "zustand";
import axios from "axios";
import { toast } from "sonner";
import { ChartNoAxesColumnDecreasing } from "lucide-react";

export interface OrderItem {
  menuItem?: string;
  name: string;
  price: number;
  quantity: number;
  id:string;
  restaurantId?: string;
  restaurantName: string;
    image: string;
}

const API_BASE_URL = "http://localhost:8000/api/orders";
axios.defaults.withCredentials = true;

export interface Order {
  _id: string;
  id:string;
  orderId: string;
  user: string;
  restaurant: string;
  restaurantName: String;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  discount: number;
  total: number;
  date: string;
  couponApplied?: {
    code: string;
    discount: number;
  };
  deliveryAddress: {
    name: string;
    phone: string;
    address: string;
  };
  paymentMethod: "card" | "cash" | "wallet";
  status: "pending" | "confirmed" | "preparing" | "out-for-delivery" | "Delivered" | "cancelled";
  pointsEarned: number;
  hasReview: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  restaurantId?: string;
  restaurantName: string;
  image?: string;
  deliveryTime?: string;
  
}

interface CartState {
  cart: CartItem[];
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  
  // Cart Actions
    getCartCount: () => number;
 addToCart: (item: CartItem) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  
  // Order Actions
  fetchOrders: () => Promise<void>;
  // createOrder: (orderData: Omit<Order, '_id' | 'orderId' | 'user' | 'createdAt' | 'updatedAt'>) => Promise<Order>;
    createOrder: (orderData:any) => Promise<Order>;
  updateOrderStatus: (orderId: string, status: Order["status"]) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
}

export const useCartStore = create<CartState>((set, get) => ({
  cart: [],
  orders: [],
  isLoading: false,
  error: null,
  getCartCount: () => {
    const { cart } = get();
    return cart.reduce((count, item) => count + item.quantity, 0);
  },
  // addToCart: (item) => {
  //   const currentCart = get().cart;
    
  //   // Check if cart has items from a different restaurant
  //   if (currentCart.length > 0 && currentCart[0].restaurantId !== item.restaurantId) {
  //     const confirmSwitch = window.confirm(
  //       `Your cart contains items from ${currentCart[0].restaurantName}. Do you want to clear it and add items from ${item.restaurantName}?`
  //     );
      
  //     if (!confirmSwitch) return;
      
  //     set({ cart: [{ ...item, quantity: item.quantity || 1 }] });
  //     return;
  //   }

  //   const existingItem = currentCart.find((i) => i.id === item.id);

  //   if (existingItem) {
  //     set({
  //       cart: currentCart.map((i) =>
  //         i.id === item.id
  //           ? { ...i, quantity: i.quantity + (item.quantity || 1) }
  //           : i
  //       ),
  //     });
  //   } else {
  //     set({
  //       cart: [...currentCart, { ...item, quantity: item.quantity || 1 }],
  //     });
  //   }
  // },
  addToCart: (item) =>
    
  set((state) => {
    
    console.log("ADDING ITEM:", item);

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

  // removeFromCart: (itemId) => {
  //   set((state) => ({
  //     cart: state.cart.filter((item) => item.id !== itemId),
  //   }));
  // },
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

  // fetchOrders: async () => {
  //   set({ isLoading: true, error: null });
  //   try {
  //     const { data } = await axios.get(`${API_BASE_URL}/`);
  //     set({ orders: data.orders || data, isLoading: false });
  //   } catch (error: any) {
  //     set({ 
  //       error: error.response?.data?.message || error.message, 
  //       isLoading: false 
  //     });
  //     console.error("Error fetching orders:", error);
  //     throw error;
  //   }
  // },
  
  fetchOrders: async () => {
  const timeAgo = (timestamp: string) => {
  const diff = Date.now() - new Date(timestamp).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
} 
  set({ isLoading: true, error: null });
console.log("🔥 FETCH ORDERS CALLED");
  try {
    const { data } = await axios.get(`${API_BASE_URL}/`);

    const mappedOrders: Order[] = data.orders.map((o: any) => ({
      _id: o._id,
      id: o.orderId,                       // UI expects this
      orderId: o.orderId,
      user: o.user,
      restaurant: o.restaurant,
      restaurantName: o.restaurantName,
      subtotal: o.subtotal,
      deliveryFee: o.deliveryFee,
      tax: o.tax,
      discount: o.discount,
      total: o.total,
      status: o.status,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      date: timeAgo(o.createdAt),          // UI expects human readable date
      pointsEarned: o.pointsEarned,
      hasReview: o.hasReview,

      items: o.items.map((i: any) => ({
        id: i.menuItem || i._id,           // needed by reorder + UI
        menuItem: i.menuItem,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        restaurantId: o.restaurant,        // not in backend → add manually
        restaurantName: o.restaurantName,
        image: i.image || ""               // default empty
      }))
    }));

    set({ orders: mappedOrders, isLoading: false });

  } catch (error: any) {
    const err = error.response?.data?.message || error.message;
    console.error("fetchOrders error:", err);
    set({ error: err, isLoading: false });
  }
},


  createOrder: async (orderData) => {
    set({ isLoading: true, error: null });
    try {
      // Send order data to backend
      console.log("Order Data Sent:", orderData);
      const { data } = await axios.post(`${API_BASE_URL}/`, orderData);
      
      const newOrder = data.order || data;
      console.log("New Order:", newOrder);
      toast.success("Order placed successfully!");
      set((state) => ({
        orders: [newOrder, ...state.orders],
        cart: [], // Clear cart after successful order
        isLoading: false,
      }));
      
      return newOrder;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      set({ error: errorMessage, isLoading: false });
      console.error("Error creating order:", error);
      throw new Error(errorMessage);
    }
  },

  updateOrderStatus: async (orderId, status) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await axios.patch(`${API_BASE_URL}/${orderId}/status`, { 
        status 
      });
      
      set((state) => ({
        orders: state.orders.map((order) =>
          order._id === orderId || order.orderId === orderId
            ? { ...order, status: data.order?.status || status } 
            : order
        ),
        isLoading: false,
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      set({ error: errorMessage, isLoading: false });
      console.error("Error updating order status:", error);
      throw new Error(errorMessage);
    }
  },

  cancelOrder: async (orderId) => {
    try {
      await get().updateOrderStatus(orderId, "cancelled");
    } catch (error) {
      console.error("Error cancelling order:", error);
      throw error;
    }
  },
  async checkout(restaurantName: string) {
    const cart = get().cart;
    if (cart.length === 0) {
      // toast.error("Cart is empty!");
      return;
    }

    const subtotal = get().getCartTotal();
    const deliveryFee = 2.99;
    const tax = subtotal * 0.08;
    const total = subtotal + deliveryFee + tax;

    const orderData = {
      restaurantName,
      items: cart.map((i) => ({
        menuItem: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
      })),
      subtotal,
      deliveryFee,
      tax,
      total,
      paymentMethod: "card",
      status: "Delivered",
      deliveryAddress: {
        name: "John Doe",
        phone: "+1 (555) 123-4567",
        address: "123 Main St",
      },
      user: "66eabcd...", // or get from auth store if you have one
    };

    try {
      const { data } = await axios.post('${API_BASE_URL}/', orderData, {
        withCredentials: true,
      });

      // toast.success("Order placed successfully!");
      set((state) => ({
        orders: [data.order, ...state.orders],
        cart: [],
      }));

      return data.order;
    } catch (err: any) {
      console.error("Order error:", err);
      // toast.error("Failed to place order");
    }
  },

}));