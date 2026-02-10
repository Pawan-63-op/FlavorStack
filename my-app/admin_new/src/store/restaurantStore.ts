// import { create } from "zustand";
// import axios from "axios";
// import { Document } from "mongoose";
// export interface Restaurant  extends Document {
//   // id: number;
//   _id:string;
//   restaurantName: string;
//   cuisine: string;
//   city: string;
//   country: string;
//   rating: number;
//   deliveryTime: string;
//   priceRange: string;
//   isOpen: boolean;
//   imageUrl?: string;
// }

// interface RestaurantState {
//   restaurants: Restaurant[];
//   isLoading: boolean;
//   error: string | null;
//   fetchRestaurants: () => Promise<void>;
//   addRestaurant: (formData: FormData) => Promise<void>;
//   updateRestaurant: (id: string, formData: FormData) => Promise<void>;
//    updateRestaurant1: (id: number,isOpen: boolean) =>  Promise<void>;
//   deleteRestaurant: (id: string) => Promise<void>;
//   toggleRestaurantStatus: (id: number) => Promise<void>;
// }
// const API_END_POINT = "http://localhost:8000/api/restaurants";
// axios.defaults.withCredentials = true;
// export const useRestaurantStore = create<RestaurantState>((set, get) => ({
//   restaurants: [],
//   isLoading: false,
//   error: null,

//   fetchRestaurants: async () => {
//     set({ isLoading: true, error: null });
//     try {
//       const { data } = await axios.get(`${API_END_POINT}/`);
//       set({ restaurants: data, isLoading: false });
//     } catch (error: any) {
//       set({ error: error.message, isLoading: false });
//       console.error("Error fetching restaurants:", error);
//     }
//   },

//   addRestaurant: async (formData:FormData) => {
//     set({ isLoading: true, error: null });
//     try {
//         // const response = await axios.post(`${API_END_POINT}/`
//       const { data } = await axios.post("http://localhost:8000/api/restaurants", formData);
//    console.log(data);
//       set((state) => ({
//         restaurants: [...state.restaurants, data],
//         isLoading: false,
//       }));
//     } catch (error: any) {
//       set({ error: error.message, isLoading: false });
//       throw error;
//     }
//   },
// updateRestaurant: async (id: string, formData: FormData) => {
//   set({ isLoading: true, error: null });
//   try {
//     const response = await fetch(`/api/restaurants/${id}`, {
//       method: "PATCH",
//       body: formData,
//       credentials: "include",
//     });

//     const updated = await response.json(); // ✅ must parse JSON

//     set((state) => ({
//       restaurants: state.restaurants.map((r) =>
//         r._id === id ? { ...r, ...updated } : r
//       ),
//       isLoading: false,
//     }));
//   } catch (error: any) {
//     set({ error: error.message, isLoading: false });
//     throw error;
//   }
// },

//   // updateRestaurant: async (id:string, formData:any) => {
//   //   set({ isLoading: true, error: null });
//   //   try {
//   //    const response = await fetch(`/api/restaurants/${id}`, {
//   //   method: "PUT",
//   //   body: formData,
//   //   credentials: "include", // include cookies if using auth
//   // });
//   //     set((state) => ({
//   //       restaurants: state.restaurants.map((r) =>
//   //         r._id === id ? { ...r, ...response. } : r
//   //       ),
//   //       isLoading: false,
//   //     }));
//   //   } catch (error: any) {
//   //     set({ error: error.message, isLoading: false });
//   //     throw error;
//   //   }
//   // },
// updateRestaurant1: async (id: number, isOpen: boolean) => {
//   set({ isLoading: true, error: null });

//   try {
//     const { data } = await axios.patch(`/api/restaurants/${id}`, { isOpen });

//    set((state) => ({
//   ...state,
//   restaurants: state.restaurants.map((r) => {
//     if (r.id !== id) return r;
//     const { schema, ...rest } = r; // remove mongoose fields
//     return { ...rest, isOpen } as Restaurant;
//   }),
//   isLoading: false,
// }));

//   } catch (error: any) {
//     console.error("Error updating restaurant status:", error);
//     set((state) => ({
//       ...state,
//       error: error.message,
//       isLoading: false,
//     }));
//   }
// },



//   deleteRestaurant: async (id: string) => {
//     set({ isLoading: true, error: null });
//     try {
//       await axios.delete(`/api/restaurants/${id}`);
//       set((state) => ({
//         restaurants: state.restaurants.filter((r) => r._id !== id),
//         isLoading: false,
//       }));
//     } catch (error: any) {
//       set({ error: error.message, isLoading: false });
//       throw error;
//     }
//   },

//   toggleRestaurantStatus: async (id) => {
//     const restaurant = get().restaurants.find((r) => r.id === id);
//     if (!restaurant) return;

//     try {
//       await get().updateRestaurant1(id, !restaurant.isOpen);
//     } catch (error) {
//       console.error("Error toggling restaurant status:", error);
//     }
//   },
//   /*toggleRestaurantStatus: async (id) => {
//   const restaurant = get().restaurants.find((r) => r.id === id);
//   if (!restaurant) return;

//   try {
//     // Flip the boolean
//     const updatedIsOpen = !restaurant.isOpen;

//     // Call your update function with the correct data
//     await get().updateRestaurant(id, { isOpen: updatedIsOpen });

//     // Optionally update local state too
//     set({
//       restaurants: get().restaurants.map((r) =>
//         r.id === id ? { ...r, isOpen: updatedIsOpen } : r
//       ),
//     });

//   } catch (error) {
//     console.error("Error toggling restaurant status:", error);
//   }
// },
//  */
// }));
import { create } from "zustand";
import axios from "axios";
import { Document } from "mongoose";

export interface Restaurant   {
   _id: string;
  restaurantName: string;
  cuisine: string;
  city: string;
  country: string;
  rating: number;
  deliveryTime: string;
  priceRange: string;
  isOpen: boolean;
  imageUrl?: string;
}

interface RestaurantState {
  restaurants: Restaurant[];
  isLoading: boolean;
  error: string | null;
  fetchRestaurants: () => Promise<void>;
  addRestaurant: (formData: FormData) => Promise<void>;
  updateRestaurant: (id: string, formData: FormData) => Promise<void>;
  updateRestaurant1: (id: number, isOpen: boolean) => Promise<void>;
  deleteRestaurant: (id: string) => Promise<void>;
  // toggleRestaurantStatus: (id: number) => Promise<void>;
}

const API_END_POINT = "http://localhost:8000/api/restaurants";
axios.defaults.withCredentials = true;

export const useRestaurantStore = create<RestaurantState>((set, get) => ({
  restaurants: [],
  isLoading: false,
  error: null,

  fetchRestaurants: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await axios.get(`${API_END_POINT}/`);
      console.log("Fetched restaurants:", data);
      
      // ✅ Backend returns { restaurants: [...] }, so extract the array
      const restaurantsArray = data.restaurants || [];
      
      set({ restaurants: restaurantsArray, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false, restaurants: [] });
      console.error("Error fetching restaurants:", error);
    }
  },

  addRestaurant: async (formData: FormData) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await axios.post(`${API_END_POINT}/`, formData);
      console.log("Add Restaurant API Response:", data);
      
      // ✅ FIX: Re-fetch to get the updated list from server
      // This ensures we always have the correct data structure
      await get().fetchRestaurants();
      
      set({ isLoading: false });
    } catch (error: any) {
      console.error("Error adding restaurant:", error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  updateRestaurant: async (id: string, formData: FormData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_END_POINT}/${id}`, {
        method: "PATCH",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Update API Response:", data);

      // ✅ FIX: Re-fetch to get the updated list from server
      await get().fetchRestaurants();
      
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  updateRestaurant1: async (id: number, isOpen: boolean) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await axios.patch(`${API_END_POINT}/${id}`, { isOpen });

      // set((state) => ({
      //   restaurants: state.restaurants.map((r) =>
      //     r.id === id ? { ...r, isOpen } : r
      //   ),
      //   isLoading: false,
      // }));
    } catch (error: any) {
      console.error("Error updating restaurant status:", error);
      set({ error: error.message, isLoading: false });
    }
  },

  deleteRestaurant: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await axios.delete(`${API_END_POINT}/${id}`);
      set((state) => ({
        restaurants: state.restaurants.filter((r) => r._id !== id),
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // toggleRestaurantStatus: async (id) => {
  //   const restaurant = get().restaurants.find((r) => r.id === id);
  //   if (!restaurant) return;

  //   try {
  //     await get().updateRestaurant1(id, !restaurant.isOpen);
  //   } catch (error) {
  //     console.error("Error toggling restaurant status:", error);
  //   }
  // },
}));