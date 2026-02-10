"use client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { motion } from "motion/react";
import { Clock, Users, ChefHat, Flame, Heart, BookOpen } from "lucide-react";
import { useState } from "react";
import { ImageWithFallback } from "@/figma/ImageWithFallback";
import { Dialog as RecipeDialog, DialogContent as RecipeDialogContent, DialogDescription as RecipeDialogDescription, DialogHeader as RecipeDialogHeader, DialogTitle as RecipeDialogTitle, DialogTrigger as RecipeDialogTrigger } from "./ui/dialog";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import { toast } from "sonner";
// import { useFavorites } from "@/context/FavoritesContext";
import { FavoriteHeart } from "./FavouriteButton";
import { useFavoritesStore } from "../store/favoritesStore";
// import  {type FavoriteButtonProps } from "./FavouriteButton";
interface Recipe {
  id: number;
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

const recipes: Recipe[] = [
  {
    id: 1,
    name: "Creamy Carbonara Pasta",
    description: "Authentic Italian carbonara with the perfect balance of eggs, cheese, and crispy pancetta",
    image: "https://images.unsplash.com/photo-1612874742237-6526221588e3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZWxpY2lvdXMlMjBwYXN0YSUyMGRpc2h8ZW58MXx8fHwxNzYwMTIzNTU4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    cookTime: "20 min",
    servings: 4,
    difficulty: "Medium",
    category: "Italian",
    calories: 650,
    ingredients: [
      "400g spaghetti",
      "200g pancetta, diced",
      "4 large eggs",
      "100g Parmesan cheese, grated",
      "2 cloves garlic, minced",
      "Salt and black pepper to taste",
      "Fresh parsley for garnish"
    ],
    instructions: [
      "Bring a large pot of salted water to boil and cook spaghetti according to package directions",
      "While pasta cooks, fry pancetta in a large pan until crispy, about 5 minutes",
      "In a bowl, whisk together eggs, Parmesan, and black pepper",
      "Reserve 1 cup pasta water, then drain pasta",
      "Remove pan from heat, add hot pasta and toss with pancetta",
      "Quickly stir in egg mixture, adding pasta water as needed to create creamy sauce",
      "Serve immediately with extra Parmesan and parsley"
    ],
    tips: "The key is to remove the pan from heat before adding eggs to prevent scrambling. The residual heat will cook them perfectly!"
  },
  {
    id: 2,
    name: "Thai Green Curry",
    description: "Aromatic and spicy coconut-based curry with fresh vegetables",
    image: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0aGFpJTIwZm9vZHxlbnwxfHx8fDE3NjAxMjM1NTl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    cookTime: "30 min",
    servings: 4,
    difficulty: "Easy",
    category: "Thai",
    calories: 450,
    ingredients: [
      "2 tbsp green curry paste",
      "400ml coconut milk",
      "300g chicken or tofu",
      "1 cup vegetables (bell peppers, eggplant, bamboo shoots)",
      "2 tbsp fish sauce",
      "1 tbsp palm sugar",
      "Thai basil leaves",
      "Kaffir lime leaves"
    ],
    instructions: [
      "Heat oil in a wok, fry curry paste until fragrant",
      "Add half the coconut milk, stir until oil separates",
      "Add chicken/tofu, cook until done",
      "Pour in remaining coconut milk and bring to simmer",
      "Add vegetables, fish sauce, and sugar",
      "Simmer for 10 minutes",
      "Garnish with basil and serve with jasmine rice"
    ]
  },
  {
    id: 3,
    name: "Classic Beef Burger",
    description: "Juicy homemade burger with all the fixings",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWVmJTIwYnVyZ2VyfGVufDF8fHx8MTc2MDEyMzU1OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    cookTime: "25 min",
    servings: 4,
    difficulty: "Easy",
    category: "American",
    calories: 750,
    ingredients: [
      "500g ground beef (80/20)",
      "4 burger buns",
      "4 slices cheese",
      "Lettuce, tomato, onion",
      "Pickles",
      "Salt and pepper",
      "Burger sauce"
    ],
    instructions: [
      "Divide beef into 4 equal portions and shape into patties",
      "Season generously with salt and pepper",
      "Heat grill or pan to high heat",
      "Cook patties 3-4 minutes per side for medium",
      "Add cheese in last minute of cooking",
      "Toast buns lightly",
      "Assemble with your favorite toppings"
    ]
  }
];

export function RecipeList() {
  // const { isFavoriteRecipe, toggleRecipe } = useFavorites();isFavoriteRecipe
  const isFavoriteRecipe = useFavoritesStore((state) => state.isFavoriteRecipe);
  const toggleRecipe = useFavoritesStore((state) => state.toggleFavoriteRecipe);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = ["All", ...Array.from(new Set(recipes.map(r => r.category)))];
  
  const filteredRecipes = selectedCategory === "All" 
    ? recipes 
    : recipes.filter(r => r.category === selectedCategory);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="mb-2">Recipe Collection</h2>
        <p className="text-muted-foreground">Step-by-step guides to create amazing dishes at home</p>
      </motion.div>

      {/* Category Filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* Recipe Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecipes.map((recipe, index) => (
          <motion.div
            key={recipe.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow overflow-hidden flex flex-col h-full">
              {/* Recipe Image */}
              <div className="relative aspect-video overflow-hidden">
                <ImageWithFallback
                  src={recipe.image}
                  alt={recipe.name}
                  className="w-full h-full object-cover"
                />
                <Badge
                  className={`absolute top-3 right-3 ${
                    recipe.difficulty === "Easy"
                      ? "bg-green-500 border-0"
                      : recipe.difficulty === "Medium"
                      ? "bg-yellow-500 border-0"
                      : "bg-red-500 border-0"
                  }`}
                >
                  {recipe.difficulty}
                </Badge>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-3 left-3 rounded-full shadow-md"
                  onClick={() => toggleRecipe({
                    id: recipe.id,
                    name: recipe.name,
                    category: recipe.category,
                    addedAt: Date.now()
                  })}
                >
                {/* <div className="absolute right-2 top-2"> */}
                  <FavoriteHeart
                    recipeId={recipe.id}
                    recipeName={recipe.name}
                    recipeCategory={recipe.category}
                    className="h-6 w-6"
                  />
                {/* </div> */}
                


                </Button>
              </div>

              <CardHeader>
                <CardTitle>{recipe.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{recipe.description}</p>
              </CardHeader>

              <CardContent className="space-y-4 flex-1 flex flex-col">
                {/* Recipe Info */}
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="flex flex-col items-center p-2 bg-accent rounded-lg">
                    <Clock className="h-4 w-4 mb-1 text-muted-foreground" />
                    <span>{recipe.cookTime}</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-accent rounded-lg">
                    <Users className="h-4 w-4 mb-1 text-muted-foreground" />
                    <span>{recipe.servings} servings</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-accent rounded-lg">
                    <Flame className="h-4 w-4 mb-1 text-muted-foreground" />
                    <span>{recipe.calories} cal</span>
                  </div>
                </div>

                {/* View Recipe Button */}
                <RecipeDialog>
                  <RecipeDialogTrigger asChild>
                    <Button className="w-full gap-2 shadow-md mt-auto">
                      <BookOpen className="h-4 w-4" />
                      View Recipe
                    </Button>
                  </RecipeDialogTrigger>
                  <RecipeDialogContent className="max-w-3xl max-h-[80vh]">
                    <RecipeDialogHeader>
                      <RecipeDialogTitle className="flex items-center gap-2">
                        <ChefHat className="h-6 w-6" />
                        {recipe.name}
                      </RecipeDialogTitle>
                      <RecipeDialogDescription>{recipe.description}</RecipeDialogDescription>
                    </RecipeDialogHeader>

                    <ScrollArea className="max-h-[60vh] pr-4">
                      <div className="space-y-6">
                        {/* Ingredients */}
                        <div>
                          <h3 className="mb-3">Ingredients</h3>
                          <div className="space-y-2">
                            {recipe.ingredients.map((ingredient, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                                <span>{ingredient}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <Separator />

                        {/* Instructions */}
                        <div>
                          <h3 className="mb-3">Instructions</h3>
                          <div className="space-y-3">
                            {recipe.instructions.map((instruction, i) => (
                              <div key={i} className="flex gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">
                                  {i + 1}
                                </div>
                                <p className="flex-1 leading-relaxed">{instruction}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Tips */}
                        {recipe.tips && (
                          <>
                            <Separator />
                            <div className="p-4 bg-accent rounded-lg">
                              <h4 className="mb-2 flex items-center gap-2">
                                <ChefHat className="h-4 w-4" />
                                Chef's Tip
                              </h4>
                              <p className="text-sm text-muted-foreground">{recipe.tips}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </ScrollArea>
                  </RecipeDialogContent>
                </RecipeDialog>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
