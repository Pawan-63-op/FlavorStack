
import { create } from "zustand";
import axios from "axios";

export interface MenuItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: 'Appetizer' | 'Main Course' | 'Dessert' | 'Beverage' | 'Side';
  image: string;
  isVegetarian: boolean;
  isSpicy: boolean;
  restaurant: string | {
    _id: string;
    restaurantName: string;
    city?: string;
    country?: string;
    imageUrl?: string;
  };
  isAvailable: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface MenuState {
  menuItems: MenuItem[];
  isLoading: boolean;
  error: string | null;
  fetchMenuItems: (restaurantId?: string) => Promise<void>;
  addMenuItem: (formData: FormData) => Promise<void>;
  updateMenuItem: (id: string, formData: FormData) => Promise<void>;
  deleteMenuItem: (id: string) => Promise<void>;
}

const API_END_POINT = "http://localhost:8000/api/menu";
axios.defaults.withCredentials = true;

export const useMenuStore = create<MenuState>((set, get) => ({
  menuItems: [],
  isLoading: false,
  error: null,

  fetchMenuItems: async (restaurantId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const url = restaurantId 
        ? `${API_END_POINT}?restaurant=${restaurantId}`
        : API_END_POINT;
      
      const { data } = await axios.get(url);
      console.log("Fetched menu items:", data);
      
      // Backend returns { menuItems: [...] }
      const menuItemsArray = data.menuItems || [];
      
      set({ menuItems: menuItemsArray, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false, menuItems: [] });
      console.error("Error fetching menu items:", error);
    }
  },

  addMenuItem: async (formData: FormData) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await axios.post(API_END_POINT, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log("Add Menu Item API Response:", data);
      
      // Re-fetch to get updated list
      await get().fetchMenuItems();
      
      set({ isLoading: false });
    } catch (error: any) {
      console.error("Error adding menu item:", error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  updateMenuItem: async (id: string, formData: FormData) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await axios.patch(`${API_END_POINT}/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log("Update Menu Item API Response:", data);
      
      // Re-fetch to get updated list
      await get().fetchMenuItems();
      
      set({ isLoading: false });
    } catch (error: any) {
      console.error("Error updating menu item:", error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  deleteMenuItem: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await axios.delete(`${API_END_POINT}/${id}`);
      set((state) => ({
        menuItems: state.menuItems.filter((item) => item._id !== id),
        isLoading: false,
      }));
    } catch (error: any) {
      console.error("Error deleting menu item:", error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
}));