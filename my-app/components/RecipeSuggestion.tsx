"use client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { motion, AnimatePresence } from "motion/react";
import { Plus, X, Search, ChefHat, Clock, Users, Sparkles } from "lucide-react";
import { useState } from "react";
import { ImageWithFallback } from "@/figma/ImageWithFallback";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

interface Recipe {
  id: number;
  name: string;
  description: string;
  image: string;
  cookTime: string;
  servings: number;
  difficulty: "Easy" | "Medium" | "Hard";
  matchedIngredients: string[];
  missingIngredients: string[];
  allIngredients: string[];
  instructions: string[];
}

const mockRecipeDatabase: Recipe[] = [
  {
    id: 1,
    name: "Classic Tomato Pasta",
    description: "Simple and delicious pasta with tomato sauce",
    image: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400",
    cookTime: "20 min",
    servings: 4,
    difficulty: "Easy",
    matchedIngredients: [],
    missingIngredients: [],
    allIngredients: ["pasta", "tomatoes", "garlic", "olive oil", "basil", "salt"],
    instructions: [
      "Boil pasta according to package directions",
      "Sauté minced garlic in olive oil",
      "Add diced tomatoes and simmer for 10 minutes",
      "Toss pasta with sauce and fresh basil",
      "Season with salt to taste"
    ]
  },
  {
    id: 2,
    name: "Chicken Stir Fry",
    description: "Quick and healthy chicken with vegetables",
    image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400",
    cookTime: "25 min",
    servings: 3,
    difficulty: "Medium",
    matchedIngredients: [],
    missingIngredients: [],
    allIngredients: ["chicken", "bell peppers", "onions", "garlic", "soy sauce", "oil", "ginger"],
    instructions: [
      "Cut chicken into bite-sized pieces",
      "Heat oil in wok over high heat",
      "Stir-fry chicken until cooked through",
      "Add vegetables and cook until tender-crisp",
      "Add soy sauce and ginger, toss to combine"
    ]
  },
  {
    id: 3,
    name: "Cheese Omelette",
    description: "Fluffy omelette with melted cheese",
    image: "https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=400",
    cookTime: "10 min",
    servings: 1,
    difficulty: "Easy",
    matchedIngredients: [],
    missingIngredients: [],
    allIngredients: ["eggs", "cheese", "butter", "salt", "pepper"],
    instructions: [
      "Beat eggs with salt and pepper",
      "Melt butter in non-stick pan",
      "Pour eggs and let set slightly",
      "Add cheese and fold omelette",
      "Cook until cheese melts"
    ]
  },
  {
    id: 4,
    name: "Garlic Bread",
    description: "Crispy toasted bread with garlic butter",
    image: "https://images.unsplash.com/photo-1573140401552-388e6d46223f?w=400",
    cookTime: "15 min",
    servings: 6,
    difficulty: "Easy",
    matchedIngredients: [],
    missingIngredients: [],
    allIngredients: ["bread", "butter", "garlic", "parsley", "salt"],
    instructions: [
      "Mix softened butter with minced garlic and parsley",
      "Spread mixture on bread slices",
      "Bake at 375°F for 10-12 minutes",
      "Serve hot and crispy"
    ]
  },
  {
    id: 5,
    name: "Caesar Salad",
    description: "Classic salad with homemade dressing",
    image: "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400",
    cookTime: "15 min",
    servings: 4,
    difficulty: "Easy",
    matchedIngredients: [],
    missingIngredients: [],
    allIngredients: ["lettuce", "parmesan", "bread", "garlic", "olive oil", "lemon", "eggs"],
    instructions: [
      "Make croutons from toasted bread cubes",
      "Prepare dressing with garlic, lemon, egg, and oil",
      "Toss lettuce with dressing",
      "Top with parmesan and croutons"
    ]
  }
];

export function RecipeSuggestion() {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [suggestedRecipes, setSuggestedRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const addIngredient = () => {
    const ingredient = inputValue.trim().toLowerCase();
    if (ingredient && !ingredients.includes(ingredient)) {
      setIngredients([...ingredients, ingredient]);
      setInputValue("");
    }
  };

  const removeIngredient = (ingredient: string) => {
    setIngredients(ingredients.filter(i => i !== ingredient));
  };

  const findRecipes = () => {
    if (ingredients.length === 0) return;

    const results = mockRecipeDatabase.map(recipe => {
      const matched = recipe.allIngredients.filter(ing => 
        ingredients.some(userIng => 
          ing.toLowerCase().includes(userIng) || userIng.includes(ing.toLowerCase())
        )
      );
      const missing = recipe.allIngredients.filter(ing => !matched.includes(ing));
      
      return {
        ...recipe,
        matchedIngredients: matched,
        missingIngredients: missing,
        matchScore: (matched.length / recipe.allIngredients.length) * 100
      };
    })
    .filter(recipe => recipe.matchedIngredients.length > 0)
    .sort((a, b) => b.matchScore - a.matchScore);

    setSuggestedRecipes(results);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="h-8 w-8 text-primary" />
          <h2>Recipe Suggestions</h2>
        </div>
        <p className="text-muted-foreground">
          Enter your available ingredients and we'll suggest recipes you can make
        </p>
      </motion.div>

      {/* Ingredient Input */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-2 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChefHat className="h-5 w-5" />
              Your Ingredients
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Input Field */}
            <div className="flex gap-2">
              <Input
                placeholder="Enter an ingredient (e.g., chicken, tomatoes, pasta)"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addIngredient()}
                className="flex-1"
              />
              <Button onClick={addIngredient} className="gap-2">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>

            {/* Ingredient Tags */}
            {ingredients.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {ingredients.map((ingredient) => (
                  <Badge
                    key={ingredient}
                    variant="secondary"
                    className="text-sm px-3 py-1 gap-2"
                  >
                    {ingredient}
                    <Button
                      onClick={() => removeIngredient(ingredient)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No ingredients added yet. Start adding ingredients above!</p>
              </div>
            )}

            {/* Search Button */}
            {ingredients.length > 0 && (
              <Button
                onClick={findRecipes}
                className="w-full gap-2"
                size="lg"
              >
                <Search className="h-5 w-5" />
                Find Recipes ({ingredients.length} ingredient{ingredients.length !== 1 ? "s" : ""})
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Recipe Results */}
      <AnimatePresence>
        {suggestedRecipes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <h3>Suggested Recipes ({suggestedRecipes.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {suggestedRecipes.map((recipe, index) => (
                <motion.div
                  key={recipe.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    className="overflow-hidden border-2 shadow-lg hover:shadow-xl transition-all cursor-pointer group h-full"
                    onClick={() => setSelectedRecipe(recipe)}
                  >
                    <div className="relative h-48 overflow-hidden">
                      <ImageWithFallback
                        src={recipe.image}
                        alt={recipe.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <Badge
                        className={`absolute top-3 right-3 ${
                          recipe.difficulty === "Easy" ? "bg-green-500" :
                          recipe.difficulty === "Medium" ? "bg-yellow-500" :
                          "bg-red-500"
                        } border-0`}
                      >
                        {recipe.difficulty}
                      </Badge>
                      <div className="absolute bottom-3 left-3">
                        <Badge className="bg-primary/90 border-0">
                          {recipe.matchedIngredients.length}/{recipe.allIngredients.length} ingredients
                        </Badge>
                      </div>
                    </div>

                    <CardContent className="pt-4 space-y-3">
                      <div>
                        <h3 className="mb-1">{recipe.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {recipe.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {recipe.cookTime}
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {recipe.servings} servings
                        </div>
                      </div>

                      {recipe.missingIngredients.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            Missing ingredients:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {recipe.missingIngredients.slice(0, 3).map((ing) => (
                              <Badge key={ing} variant="outline" className="text-xs">
                                {ing}
                              </Badge>
                            ))}
                            {recipe.missingIngredients.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{recipe.missingIngredients.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recipe Detail Dialog */}
      <Dialog open={!!selectedRecipe} onOpenChange={() => setSelectedRecipe(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          {selectedRecipe && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedRecipe.name}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {selectedRecipe.description}
                </p>
              </DialogHeader>
              <ScrollArea className="h-[60vh]">
                <div className="space-y-6 pr-4">
                    {/* Image */}
                    <div className="relative h-64 rounded-lg overflow-hidden">
                      <ImageWithFallback
                        src={selectedRecipe.image}
                        alt={selectedRecipe.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Info */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 bg-accent rounded-lg">
                        <Clock className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm">{selectedRecipe.cookTime}</p>
                      </div>
                      <div className="text-center p-3 bg-accent rounded-lg">
                        <Users className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm">{selectedRecipe.servings} servings</p>
                      </div>
                      <div className="text-center p-3 bg-accent rounded-lg">
                        <ChefHat className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm">{selectedRecipe.difficulty}</p>
                      </div>
                    </div>

                    <Separator />

                    {/* Ingredients */}
                    <div>
                      <h4 className="mb-3">Ingredients</h4>
                      <div className="space-y-2">
                        {selectedRecipe.allIngredients.map((ing) => {
                          const isMatched = selectedRecipe.matchedIngredients.includes(ing);
                          return (
                            <div
                              key={ing}
                              className={`flex items-center gap-2 p-2 rounded ${
                                isMatched ? "bg-green-500/10" : "bg-muted"
                              }`}
                            >
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  isMatched ? "bg-green-500" : "bg-muted-foreground"
                                }`}
                              />
                              <span className={isMatched ? "" : "text-muted-foreground"}>
                                {ing}
                              </span>
                              {isMatched && (
                                <Badge variant="secondary" className="ml-auto text-xs">
                                  You have this
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <Separator />

                    {/* Instructions */}
                    <div>
                      <h4 className="mb-3">Instructions</h4>
                      <ol className="space-y-3">
                        {selectedRecipe.instructions.map((instruction, idx) => (
                          <li key={idx} className="flex gap-3">
                            <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">
                              {idx + 1}
                            </span>
                            <span className="flex-1 pt-0.5">{instruction}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </ScrollArea>
              </>
            )}
          </DialogContent>
        </Dialog>
    </div>
  );
}
