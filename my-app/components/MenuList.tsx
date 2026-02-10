import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { motion, AnimatePresence } from "motion/react";
import { Clock, Flame, Leaf, ShoppingCart, Plus } from "lucide-react";
import { useState } from "react";
import { ImageWithFallback } from "@/figma/ImageWithFallback";
import { toast } from "sonner";

interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  prepTime: string;
  calories: number;
  isVegetarian: boolean;
  isSpicy: boolean;
  isPopular: boolean;
}

const menuItems: MenuItem[] = [
  {
    id: 1,
    name: "Creamy Carbonara",
    description: "Classic Italian pasta with pancetta, eggs, parmesan, and black pepper",
    price: 18.99,
    image: "https://images.unsplash.com/photo-1612874742237-6526221588e3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZWxpY2lvdXMlMjBwYXN0YSUyMGRpc2h8ZW58MXx8fHwxNzYwMTIzNTU4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    category: "Pasta",
    prepTime: "20 min",
    calories: 650,
    isVegetarian: false,
    isSpicy: false,
    isPopular: true
  },
  {
    id: 2,
    name: "Classic Beef Burger",
    description: "Angus beef patty, cheddar, lettuce, tomato, onion, special sauce",
    price: 15.99,
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXJnZXIlMjBmb29kfGVufDF8fHx8MTc2MDEyMzU1OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    category: "Burgers",
    prepTime: "15 min",
    calories: 750,
    isVegetarian: false,
    isSpicy: false,
    isPopular: true
  },
  {
    id: 3,
    name: "Margherita Pizza",
    description: "Fresh mozzarella, tomato sauce, basil, extra virgin olive oil",
    price: 16.99,
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaXp6YSUyMHJlc3RhdXJhbnR8ZW58MXx8fHwxNzYwMTIzNTU5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    category: "Pizza",
    prepTime: "25 min",
    calories: 580,
    isVegetarian: true,
    isSpicy: false,
    isPopular: true
  },
  {
    id: 4,
    name: "Premium Sushi Platter",
    description: "12 pieces of assorted nigiri and maki rolls with wasabi and ginger",
    price: 28.99,
    image: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdXNoaSUyMHBsYXR0ZXJ8ZW58MXx8fHwxNzYwMTIzNTU5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    category: "Japanese",
    prepTime: "30 min",
    calories: 450,
    isVegetarian: false,
    isSpicy: false,
    isPopular: false
  },
  {
    id: 5,
    name: "Mediterranean Salad Bowl",
    description: "Mixed greens, feta, olives, cucumbers, tomatoes, balsamic dressing",
    price: 12.99,
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHNhbGFkJTIwYm93bHxlbnwxfHx8fDE3NjAxMjM1NTl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    category: "Salads",
    prepTime: "10 min",
    calories: 320,
    isVegetarian: true,
    isSpicy: false,
    isPopular: false
  },
  {
    id: 6,
    name: "Chocolate Lava Cake",
    description: "Warm chocolate cake with molten center, vanilla ice cream",
    price: 9.99,
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZXNzZXJ0JTIwY2FrZXxlbnwxfHx8fDE3NjAxMjM1NjB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    category: "Desserts",
    prepTime: "15 min",
    calories: 520,
    isVegetarian: true,
    isSpicy: false,
    isPopular: true
  },
  {
    id: 7,
    name: "Grilled Ribeye Steak",
    description: "12oz ribeye, garlic butter, seasonal vegetables, mashed potatoes",
    price: 34.99,
    image: "https://images.unsplash.com/photo-1546964124-0cce460f38ef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdGVhayUyMGRpbm5lcnxlbnwxfHx8fDE3NjAxMjM1NjB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    category: "Steaks",
    prepTime: "25 min",
    calories: 890,
    isVegetarian: false,
    isSpicy: false,
    isPopular: true
  }
];

const categories = ["All", "Pasta", "Burgers", "Pizza", "Japanese", "Salads", "Desserts", "Steaks"];

export function MenuList() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cart, setCart] = useState<Record<number, number>>({});

  const filteredItems = selectedCategory === "All" 
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

  const addToCart = (item: MenuItem) => {
    setCart(prev => ({
      ...prev,
      [item.id]: (prev[item.id] || 0) + 1
    }));
    toast.success(`Added ${item.name} to cart!`);
  };

  const cartItemCount = Object.values(cart).reduce((sum, count) => sum + count, 0);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <h2 className="mb-2">Our Menu</h2>
          <p className="text-muted-foreground">Discover our delicious selection of dishes</p>
        </div>
        {cartItemCount > 0 && (
          <Button className="gap-2 shadow-md">
            <ShoppingCart className="h-5 w-5" />
            Cart ({cartItemCount})
          </Button>
        )}
      </motion.div>

      {/* Category Filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-2 shadow-md">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category)}
                  className="transition-all"
                >
                  {category}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Menu Items Grid */}
      <AnimatePresence mode="popLayout">
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          layout
        >
          {filteredItems.map((item, index) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card className="overflow-hidden border-2 shadow-lg hover:shadow-xl transition-all group">
                {/* Image */}
                <div className="relative h-48 overflow-hidden">
                  <ImageWithFallback
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute top-3 right-3 flex gap-2">
                    {item.isPopular && (
                      <Badge className="bg-orange-500 hover:bg-orange-600 border-0">
                        Popular
                      </Badge>
                    )}
                  </div>
                  <div className="absolute top-3 left-3 flex flex-col gap-2">
                    {item.isVegetarian && (
                      <Badge variant="secondary" className="gap-1">
                        <Leaf className="h-3 w-3" />
                        Vegetarian
                      </Badge>
                    )}
                    {item.isSpicy && (
                      <Badge variant="destructive" className="gap-1">
                        <Flame className="h-3 w-3" />
                        Spicy
                      </Badge>
                    )}
                  </div>
                </div>

                <CardContent className="pt-4 space-y-3">
                  {/* Title and Price */}
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="mb-1">{item.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {item.prepTime}
                    </div>
                    <div className="flex items-center gap-1">
                      <Flame className="h-4 w-4" />
                      {item.calories} cal
                    </div>
                  </div>

                  {/* Price and Add Button */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-2xl">${item.price.toFixed(2)}</span>
                    <Button 
                      onClick={() => addToCart(item)}
                      className="gap-2 shadow-md"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* No results */}
      {filteredItems.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <p className="text-muted-foreground">No items found in this category.</p>
        </motion.div>
      )}
    </div>
  );
}
