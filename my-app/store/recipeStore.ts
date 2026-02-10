import { create } from "zustand";
import axios from "axios";
export interface Recipe {
  _id: string;
  name: string;
  description: string;
  image: string;
  cookTime: string;
  servings: number;
  difficulty: "Easy" | "Medium" | "Hard";
  category: string;
  calories: number;
  ingredients: string[];
  instructions: string[];
  tips?: string;
}

interface RecipeStore {
  recipes: Recipe[];
  loading: boolean;
  error: string | null;

  fetchRecipes: () => Promise<void>;
  fetchRecipeById: (id: string) => Promise<Recipe | null>;
  filterRecipes: (filters: { category?: string; difficulty?: string }) => Promise<void>;
}

export const useRecipeStore = create<RecipeStore>((set, get) => ({
  recipes: [],
  loading: false,
  error: null,

  // 🔥 Fetch all recipes
  fetchRecipes: async () => {
    try {
      set({ loading: true, error: null });

      const res = await axios.get("/recipes");

      set({
        recipes: res.data,
        loading: false,
      });
    } catch (error: any) {
      set({
        loading: false,
        error: error.response?.data?.message || "Failed to fetch recipes",
      });
    }
  },

  // 🔥 Fetch single recipe (useful for recipe page)
  fetchRecipeById: async (id: string) => {
    try {
      set({ loading: true });

      const res = await axios.get(`/recipes/${id}`);

      set({ loading: false });

      return res.data;
    } catch (error) {
      set({ loading: false });
      return null;
    }
  },

  // 🔥 Filter recipes (category OR difficulty)
  filterRecipes: async (filters) => {
    try {
      set({ loading: true });

      const params: any = {};
      if (filters.category) params.category = filters.category;
      if (filters.difficulty) params.difficulty = filters.difficulty;

      const res = await axios.get("/recipes", { params });

      set({
        recipes: res.data,
        loading: false,
      });
    } catch (error) {
      set({ loading: false });
    }
  }
}));
