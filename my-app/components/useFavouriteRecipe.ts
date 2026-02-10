import { useFavoritesStore } from "@/store/favoritesStore";

export function useFavoriteRecipe(id: number) {
  const isFavorite = useFavoritesStore((state) =>
    state.favoritesRecipe.some((r) => r.id === id)
  );
  const toggleFavoriteRecipe = useFavoritesStore(
    (state) => state.toggleFavoriteRecipe
  );

  return { isFavorite, toggleFavoriteRecipe };
}
