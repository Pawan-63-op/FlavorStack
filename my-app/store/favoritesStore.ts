import { create } from "zustand";
import { toast } from "sonner";

const BASE = "http://localhost:8000/api";

export interface FavoriteRestaurant {
  id: string;        // was number — MongoDB _id is always string
  name: string;
  cuisine: string;
  rating: number;
  deliveryTime: string;
  image: string;
  addedAt?: any;
}

export interface FavoriteRecipe {
  id: number;        // stays number — hardcoded static data
  name: string;
  category: string;
  addedAt?: number;
}

interface FavoritesState {
  favorites: FavoriteRestaurant[];
  favoritesRecipe: FavoriteRecipe[];
  isLoading: boolean;

  // Restaurants — persisted to MongoDB via backend
  fetchFavorites: () => Promise<void>;
  addFavorite: (restaurant: FavoriteRestaurant) => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (restaurant: FavoriteRestaurant) => Promise<void>;

  // Recipes — local only, hardcoded data needs no backend
  addFavoriteRecipe: (recipe: FavoriteRecipe) => void;
  removeFavoriteRecipe: (id: number) => void;
  isFavoriteRecipe: (id: number) => boolean;
  toggleFavoriteRecipe: (recipe: FavoriteRecipe) => void;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],
  favoritesRecipe: [],
  isLoading: false,

  // ── Restaurants ──────────────────────────────────────────────────────────────

  fetchFavorites: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${BASE}/favorites`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch favorites");
      const data = await res.json();

      const populated = data.favorites?.restaurants || [];
      const formatted: FavoriteRestaurant[] = populated.map((item: any) => {
        const r = item.restaurant;
        return {
          id: r._id?.toString() || r.id,
          name: r.restaurantName || r.name,
          cuisine: r.cuisine,
          rating: r.rating,
          deliveryTime: r.deliveryTime,
          image: r.imageUrl || r.image || "",
          addedAt: item.addedAt,
        };
      });

      set({ favorites: formatted, isLoading: false });
    } catch (err) {
      console.error("fetchFavorites error:", err);
      set({ isLoading: false });
    }
  },

  addFavorite: async (restaurant) => {
    set((s) => ({ favorites: [restaurant, ...s.favorites] }));
    toast.success(`${restaurant.name} added to favorites!`);
    try {
      const res = await fetch(`${BASE}/favorites/restaurant/${restaurant.id}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        if (err.message === "Restaurant already in favorites") return;
        throw new Error(err.message);
      }
    } catch (err: any) {
      set((s) => ({ favorites: s.favorites.filter((f) => f.id !== restaurant.id) }));
      toast.error(err.message || "Failed to add to favorites");
    }
  },

  removeFavorite: async (id) => {
    const restaurant = get().favorites.find((f) => f.id === id);
    set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) }));
    if (restaurant) toast.success(`${restaurant.name} removed from favorites`);
    try {
      const res = await fetch(`${BASE}/favorites/restaurant/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove");
    } catch (err: any) {
      if (restaurant) set((s) => ({ favorites: [...s.favorites, restaurant] }));
      toast.error(err.message || "Failed to remove from favorites");
    }
  },

  isFavorite: (id) => get().favorites.some((f) => f.id === id),

  toggleFavorite: async (restaurant) => {
    if (get().isFavorite(restaurant.id)) {
      await get().removeFavorite(restaurant.id);
    } else {
      await get().addFavorite(restaurant);
    }
  },

  // ── Recipes (local hardcoded — no backend needed) ────────────────────────────

  addFavoriteRecipe: (recipe) => {
    const { favoritesRecipe } = get();
    if (!favoritesRecipe.find((f) => f.id === recipe.id)) {
      set({ favoritesRecipe: [...favoritesRecipe, recipe] });
      toast.success(`${recipe.name} added to favorites!`);
    }
  },

  removeFavoriteRecipe: (id) => {
    const recipe = get().favoritesRecipe.find((f) => f.id === id);
    set((s) => ({ favoritesRecipe: s.favoritesRecipe.filter((f) => f.id !== id) }));
    if (recipe) toast.success(`${recipe.name} removed from favorites`);
  },

  isFavoriteRecipe: (id) => get().favoritesRecipe.some((f) => f.id === id),

  toggleFavoriteRecipe: (recipe) => {
    set((state) => {
      const exists = state.favoritesRecipe.some((r) => r.id === recipe.id);
      if (exists) {
        toast.success(`${recipe.name} removed from favorites!`);
        return { favoritesRecipe: state.favoritesRecipe.filter((r) => r.id !== recipe.id) };
      }
      toast.success(`${recipe.name} added to favorites!`);
      return {
        favoritesRecipe: [
          ...state.favoritesRecipe,
          { ...recipe, addedAt: recipe.addedAt ?? Date.now() },
        ],
      };
    });
  },
}));
