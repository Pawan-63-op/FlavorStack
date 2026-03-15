"use client";
import { highlight } from "./highlight";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Clock, Star, Filter, DollarSign, Heart } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
interface Restaurant {
  id: string;
  name: string;
  restaurantName: string;
  cuisine: string;
  rating: number;
  deliveryTime: string;
  image: string;
  city: string;
  country: string;
  priceRange: "$" | "$$" | "$$$";
  isOpen: boolean;
}

interface RestaurantListProps {
  searchData?: { query?: string; type?: string; cuisine?: string };
  onNavigate: (page: string, data?: any) => void;
}

import { useFavoritesStore } from "@/store/favoritesStore";
import { toast } from "sonner";

// Image component with fallback
const ImageWithFallback = ({ src, alt, className }: any) => {
  const [imgSrc, setImgSrc] = useState(src);
  
  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      onError={() => setImgSrc('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800')}
    />
  );
};

export default function RestaurantList({ searchData, onNavigate }: RestaurantListProps) {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedCuisine, setSelectedCuisine] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"rating" | "deliveryTime">("rating");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isFavorite = useFavoritesStore((state) => state.isFavorite);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);

  const cuisines = ["All", "Italian", "Japanese", "Mexican", "Chinese", "Indian", "American"];

  // Fetch restaurants from MongoDB via backend API
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const res = await fetch("http://localhost:8000/api/restaurants");
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data2 = await res.json();
        const data= data2.restaurants;
        // Convert MongoDB _id to string id and ensure proper formatting
        const formatted = data.map((r: any) => ({
          id: r._id?.toString() || r.id,
          // name: r.name,
          restaurantName: r.restaurantName,
          cuisine: r.cuisine,
          rating: r.rating,
          deliveryTime: r.deliveryTime,
          image: r.imageUrl,
          city: r.city,
          country: r.country,
          priceRange: r.priceRange,
          isOpen: r.isOpen
        }));
        
        setRestaurants(formatted);
      } catch (error) {
        console.error("Error fetching restaurants:", error);
        setError(error instanceof Error ? error.message : "Failed to fetch restaurants");
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  // Filtering + Sorting
  const filteredRestaurants = useMemo(() => {
    let filtered = restaurants;

    // Apply search filter
   
// AFTER
if (searchData?.query?.trim() && searchData?.type) {
  const words = searchData.query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const matchesAnyWord = (...fields: string[]) =>
    words.some((word) =>
      fields.some((field) => field.toLowerCase().includes(word))
    );

  filtered = filtered.filter((r) => {
    switch (searchData.type) {
      case "name":
        return matchesAnyWord(r.restaurantName);
      case "city":
        return matchesAnyWord(r.city);
      case "country":
        return matchesAnyWord(r.country);
      case "menu":
        return matchesAnyWord(r.cuisine);
      default:
        return true;
    }
  });
}
    // Apply cuisine filter
    if (selectedCuisine !== "All") {
      filtered = filtered.filter((r) => r.cuisine === selectedCuisine);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "rating") {
        return b.rating - a.rating;
      }
      return parseInt(a.deliveryTime) - parseInt(b.deliveryTime);
    });

    return sorted;
  }, [searchData, selectedCuisine, sortBy, restaurants]);

  // Loading state
  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg text-muted-foreground">Loading restaurants...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full max-w-7xl mx-auto p-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-lg text-destructive mb-4">Error loading restaurants</p>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-3xl font-bold mb-2">
          {searchData?.query ? `Results for "${searchData.query}"` : "All Restaurants"}
        </h2>
        <p className="text-muted-foreground">{filteredRestaurants.length} restaurants found</p>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border-2 shadow-md">
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Cuisine Filter */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filter by Cuisine</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cuisines.map((cuisine) => (
                    <Button
                      key={cuisine}
                      variant={selectedCuisine === cuisine ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCuisine(cuisine)}
                    >
                      {cuisine}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div className="lg:w-48">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium">Sort by</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={sortBy === "rating" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSortBy("rating")}
                    className="flex-1"
                  >
                    Rating
                  </Button>
                  <Button
                    variant={sortBy === "deliveryTime" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSortBy("deliveryTime")}
                    className="flex-1"
                  >
                    Delivery Time
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Restaurant Grid */}
      <AnimatePresence mode="popLayout">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRestaurants.map((restaurant, index) => (
            <motion.div
              key={restaurant.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card
                className="overflow-hidden border-2 shadow-lg hover:shadow-xl transition-all cursor-pointer group"
                onClick={() => onNavigate("restaurant", { id: restaurant.id })}
                // onClick={()=> router}
              >
                <div className="relative h-48 overflow-hidden">
                  <ImageWithFallback
                    src={restaurant.image}
                    alt={restaurant.restaurantName}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite({
                        id: Number(restaurant.id),
                        name: restaurant.restaurantName,
                        cuisine: restaurant.cuisine,
                        rating: restaurant.rating,
                        addedAt: Date.now(),
                        deliveryTime: restaurant.deliveryTime,
                        image: restaurant.image,
                      });
                    }}
                  >
                    <Heart
                      className={`h-5 w-5 ${
                        isFavorite(Number(restaurant.id)) ? "fill-red-500 text-red-500" : ""
                      }`}
                    /> {restaurant.id}
                  </Button>

                  {!restaurant.isOpen && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Badge variant="destructive" className="text-lg">
                        Closed
                      </Badge>
                    </div>
                  )}

                  <Badge className="absolute top-3 right-3 bg-white/90 text-foreground hover:bg-white">
                    <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                    {restaurant.rating}
                  </Badge>
                 <Badge className="absolute top-3 left-3 bg-primary/90 border-0">
  {highlight(restaurant.cuisine, searchData?.query || "")}
</Badge>
                </div>

                <CardContent className="pt-4 space-y-3">
                  <div>

                    <h3 className="font-semibold text-lg mb-1">
                {highlight(restaurant.restaurantName, searchData?.query || "")}
              </h3>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                     <span>
  {highlight(restaurant.city, searchData?.query || "")},{" "}
  {highlight(restaurant.country, searchData?.query || "")}
</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{restaurant.deliveryTime}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{restaurant.priceRange}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>

      {/* No Results */}
      {filteredRestaurants.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
          <p className="text-muted-foreground text-lg mb-4">
            No restaurants found with the selected filters.
          </p>
          <Button variant="outline" onClick={() => setSelectedCuisine("All")}>
            Clear Filters
          </Button>
        </motion.div>
      )}
    </div>
  );
}