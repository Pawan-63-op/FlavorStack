// import { create } from "zustand";
// import { toast } from "sonner";
// import type { Date } from "mongoose";

// export interface FavoriteRestaurant {
//   id: number;
//   name: string;
//   cuisine: string;
//   rating: number;
//   deliveryTime: string;
//   image: string;
//   addedAt?:any;
// }

// export interface FavoriteRecipe {
//   id: number;
//   name: string;
//   category: string;
//   addedAt?: number;
// }
// interface FavoritesState {
//   favorites: FavoriteRestaurant[];
//   addFavorite: (restaurant: FavoriteRestaurant) => void;
//   removeFavorite: (id: number) => void;
//   isFavorite: (id: number) => boolean;
//   toggleFavorite: (restaurant: FavoriteRestaurant) => void;
//     favoritesRecipe: FavoriteRecipe[];
//   addFavoriteRecipe: (Recipe: FavoriteRecipe) => void;
//   removeFavoriteRecipe: (id: number) => void;
//   isFavoriteRecipe: (id: number) => boolean;
//   toggleFavoriteRecipe: (Recipe: FavoriteRecipe) => void;
// }

// export const useFavoritesStore = create<FavoritesState>((set, get) => ({
//   favorites: [],
//  favoritesRecipe: [],
//   addFavorite: (restaurant) => {
//     const { favorites } = get();
//     if (!favorites.find((f) => f.id === restaurant.id)) {
//       set({ favorites: [...favorites, restaurant] });
//       toast.success(`${restaurant.name} added to favorites!`);
//     }
//   },
//     addFavoriteRecipe: (Recipe) => {
//     const { favoritesRecipe } = get();
//     if (!favoritesRecipe.find((f) => f.id === Recipe.id)) {
//       set({ favoritesRecipe: [...favoritesRecipe, Recipe] });
//       toast.success(`${Recipe.name} added to favoritesRecipe!`);
//     }
//   },

//   removeFavorite: (id) => {
//     const { favorites } = get();
//     const restaurant = favorites.find((f) => f.id === id);
//     set({ favorites: favorites.filter((f) => f.id !== id) });
//     if (restaurant) {
//       toast.success(`${restaurant.name} removed from favorites`);
//     }
//   },
//   removeFavoriteRecipe: (id) => {
//     const { favoritesRecipe } = get();
//     const Recipe = favoritesRecipe.find((f) => f.id === id);
//     set({ favoritesRecipe: favoritesRecipe.filter((f) => f.id !== id) });
//     if (Recipe) {
//       toast.success(`${Recipe.name} removed from favoritesRecipe`);
//     }
//   },

//   isFavorite: (id) => {
//     const { favorites } = get();
//     return favorites.some((f) => f.id === id);
//   },
//   isFavoriteRecipe: (id) => {
//     const { favoritesRecipe } = get();
//     return favoritesRecipe.some((f) => f.id === id);
//   },
//   toggleFavorite: (restaurant) => {
//     const { isFavorite, addFavorite, removeFavorite } = get();
//     if (isFavorite(restaurant.id)) {
//       removeFavorite(restaurant.id);
//     } else {
//       addFavorite(restaurant);
//     }
//   },
// //     toggleFavoriteRecipe: (recipe) => {
// //   set((state) => {
// //     const exists = state.favoritesRecipe.some((r) => r.id === recipe.id);

// //     if (exists) {
// //       // Remove
// //       toast.success(`${recipe.name} removed from favorites!`);
// //       return {
// //         favoritesRecipe: state.favoritesRecipe.filter((r) => r.id !== recipe.id),
// //       };
// //     } else {
// //       // Add
// //       toast.success(`${recipe.name} added to favorites!`);
// //       return {
// //         favoritesRecipe: [
// //           ...state.favoritesRecipe,
// //           { ...recipe, addedAt: recipe.addedAt ?? Date.now() },
// //         ],
// //       };
// //     }
// //   });
// // },
// toggleFavoriteRecipe: (recipe) => {
//   // Read current state snapshot first
//   const state = useFavoritesStore.getState();
//   const exists = state.favoritesRecipe.some((r) => r.id === recipe.id);

//   // Compute new favorites array
//   const newFavorites = exists
//     ? state.favoritesRecipe.filter((r) => r.id !== recipe.id)
//     : [...state.favoritesRecipe, { ...recipe, addedAt: recipe.addedAt ?? Date.now() }];

//   // Update state
//   useFavoritesStore.setState({ favoritesRecipe: newFavorites });

//   // Fire toast once, based on previous state
//   if (exists) {
//     toast.success(`${recipe.name} removed from favorites!`);
//   } else {
//     toast.success(`${recipe.name} added to favorites!`);
//   }
// }



// }));
import { create } from "zustand"
import { toast } from "sonner"

export interface FavoriteRestaurant {
  id: number
  name: string
  cuisine: string
  rating: number
  deliveryTime: string
  image: string
  addedAt?: any
}

export interface FavoriteRecipe {
  id: number
  name: string
  category: string
  addedAt?: number
}
interface FavoritesState {
  favorites: FavoriteRestaurant[]
  addFavorite: (restaurant: FavoriteRestaurant) => void
  removeFavorite: (id: number) => void
  isFavorite: (id: number) => boolean
  toggleFavorite: (restaurant: FavoriteRestaurant) => void
  favoritesRecipe: FavoriteRecipe[]
  addFavoriteRecipe: (Recipe: FavoriteRecipe) => void
  removeFavoriteRecipe: (id: number) => void
  isFavoriteRecipe: (id: number) => boolean
  toggleFavoriteRecipe: (Recipe: FavoriteRecipe) => void
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],
  favoritesRecipe: [],
  addFavorite: (restaurant) => {
    const { favorites } = get()
    if (!favorites.find((f) => f.id === restaurant.id)) {
      set({ favorites: [...favorites, restaurant] })
      toast.success(`${restaurant.name}   added to favorites!`)
    }
  },
  addFavoriteRecipe: (Recipe) => {
    const { favoritesRecipe } = get()
    if (!favoritesRecipe.find((f) => f.id === Recipe.id)) {
      set({ favoritesRecipe: [...favoritesRecipe, Recipe] })
      toast.success(`${Recipe.name}  op added to favoritesRecipe!`)
    }
  },

  removeFavorite: (id) => {
    const { favorites } = get()
    const restaurant = favorites.find((f) => f.id === id)
    set({ favorites: favorites.filter((f) => f.id !== id) })
    if (restaurant) {
      toast.success(`${restaurant.name} removed from favorites`)
    }
  },
  removeFavoriteRecipe: (id) => {
    const { favoritesRecipe } = get()
    const Recipe = favoritesRecipe.find((f) => f.id === id)
    set({ favoritesRecipe: favoritesRecipe.filter((f) => f.id !== id) })
    if (Recipe) {
      toast.success(`${Recipe.name} removed from favoritesRecipe`)
    }
  },

  isFavorite: (id) => {
    const { favorites } = get()
    return favorites.some((f) => f.id === id)
  },
  isFavoriteRecipe: (id) => {
    const { favoritesRecipe } = get()
    return favoritesRecipe.some((f) => f.id === id)
  },
  toggleFavorite: (restaurant) => {
    const { isFavorite, addFavorite, removeFavorite } = get()
    if (isFavorite(restaurant.id)) {
      removeFavorite(restaurant.id)
    } else {
      addFavorite(restaurant)
    }
  },
  toggleFavoriteRecipe: (recipe) => {
    set((state) => {
      const exists = state.favoritesRecipe.some((r) => r.id === recipe.id)

      if (exists) {
        toast.success(`${recipe.name} removed from favorites!`)
        return {
          favoritesRecipe: state.favoritesRecipe.filter((r) => r.id !== recipe.id),
        }
      } else {
        toast.success(`${recipe.name} added to favorites!`)
        return {
          favoritesRecipe: [...state.favoritesRecipe, { ...recipe, addedAt: recipe.addedAt ?? Date.now() }],
        }
      }
    })
  },
}))
