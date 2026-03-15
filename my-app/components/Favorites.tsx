"use client";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Store, ChefHat, Star, Loader2 } from "lucide-react";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function Favorites() {
  const router = useRouter();

  const favorites = useFavoritesStore((s) => s.favorites);
  const favoritesRecipe = useFavoritesStore((s) => s.favoritesRecipe);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const toggleRecipe = useFavoritesStore((s) => s.toggleFavoriteRecipe);
  const fetchFavorites = useFavoritesStore((s) => s.fetchFavorites);
  const isLoading = useFavoritesStore((s) => s.isLoading);

  // Load saved restaurant favorites from server on mount
  useEffect(() => {
    fetchFavorites();
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <Heart className="h-8 w-8 text-red-500 fill-red-500" />
          <h1>My Favorites</h1>
        </div>
        <p className="text-muted-foreground">
          Quick access to your favorite restaurants and recipes
        </p>
      </motion.div>

      <Tabs defaultValue="restaurants" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="restaurants" className="gap-2">
            <Store className="h-4 w-4" />
            Restaurants ({favorites.length})
          </TabsTrigger>
          <TabsTrigger value="recipes" className="gap-2">
            <ChefHat className="h-4 w-4" />
            Recipes ({favoritesRecipe.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Restaurants tab ── */}
        <TabsContent value="restaurants" className="space-y-4 mt-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : favorites.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {favorites.map((restaurant, index) => (
                  <motion.div
                    key={restaurant.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="border-2 shadow-md hover:shadow-xl transition-shadow">
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="mb-1">{restaurant.name}</h3>
                              <Badge variant="secondary">{restaurant.cuisine}</Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleFavorite(restaurant)}
                              className="text-red-500"
                            >
                              <Heart className="h-5 w-5 fill-red-500" />
                            </Button>
                          </div>

                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span>{restaurant.rating}</span>
                          </div>

                          <Button
                            onClick={() => router.push(`/restaurants/${restaurant.id}`)}
                            className="w-full"
                          >
                            View Menu
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <Card className="border-2">
              <CardContent className="pt-12 pb-12 text-center">
                <Store className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="mb-2">No favorite restaurants yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start adding your favorite restaurants!
                </p>
                <Button onClick={() => router.push("/restaurants")}>
                  Browse Restaurants
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Recipes tab (hardcoded local data) ── */}
        <TabsContent value="recipes" className="space-y-4 mt-6">
          {favoritesRecipe.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {favoritesRecipe.map((recipe, index) => (
                  <motion.div
                    key={recipe.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="border-2 shadow-md hover:shadow-xl transition-shadow">
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="mb-1">{recipe.name}</h3>
                              <Badge variant="secondary">{recipe.category}</Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleRecipe(recipe)}
                              className="text-red-500"
                            >
                              <Heart className="h-5 w-5 fill-red-500" />
                            </Button>
                          </div>
                          <Button
                            onClick={() => router.push("/recipes")}
                            className="w-full"
                            variant="outline"
                          >
                            View Recipe
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <Card className="border-2">
              <CardContent className="pt-12 pb-12 text-center">
                <ChefHat className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="mb-2">No favorite recipes yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start adding your favorite recipes!
                </p>
                <Button onClick={() => router.push("/recipes")}>
                  Browse Recipes
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
