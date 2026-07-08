"use client";
import { highlight } from "./highlight";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Filter, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useRestaurantList } from "@/lib/api/hooks/useCatalog";
import { cuisineLabel, type CuisineType } from "@/lib/api/adapters/restaurant";
import { ApiError } from "@/lib/api/errors/ApiError";

interface RestaurantListProps {
  searchData?: { query?: string; type?: string; cuisine?: string };
  onNavigate: (page: string, data?: any) => void;
}

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

const CUISINE_TYPES: CuisineType[] = [
  "NORTH_INDIAN",
  "SOUTH_INDIAN",
  "CHINESE",
  "ITALIAN",
  "MEXICAN",
  "CONTINENTAL",
  "FAST_FOOD",
  "BAKERY",
  "DESSERTS",
  "BEVERAGES",
  "SEAFOOD",
  "STREET_FOOD",
];

export default function RestaurantList({ searchData, onNavigate }: RestaurantListProps) {
  const [selectedCuisine, setSelectedCuisine] = useState<CuisineType | "All">("All");

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useRestaurantList(
    selectedCuisine === "All" ? {} : { cuisineTypes: [selectedCuisine] },
  );

  const restaurants = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  // Name-only filter on the page(s) already loaded. Full-text/city/country
  // search against the server lands in Batch 4.3 (`/catalog/search/restaurants`).
  const filteredRestaurants = useMemo(() => {
    const query = searchData?.query?.trim().toLowerCase();
    if (!query) return restaurants;
    return restaurants.filter((r) => r.name.toLowerCase().includes(query));
  }, [restaurants, searchData?.query]);

  // Loading state
  if (isLoading) {
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
  if (isError) {
    const message = error instanceof ApiError ? error.message : "Failed to fetch restaurants";
    return (
      <div className="w-full max-w-7xl mx-auto p-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-lg text-destructive mb-4">Error loading restaurants</p>
              <p className="text-sm text-muted-foreground mb-4">{message}</p>
              <Button onClick={() => refetch()}>Retry</Button>
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
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filter by Cuisine</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCuisine === "All" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCuisine("All")}
              >
                All
              </Button>
              {CUISINE_TYPES.map((cuisine) => (
                <Button
                  key={cuisine}
                  variant={selectedCuisine === cuisine ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCuisine(cuisine)}
                >
                  {cuisineLabel(cuisine)}
                </Button>
              ))}
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
              >
                <div className="relative h-48 overflow-hidden">
                  <ImageWithFallback
                    src={restaurant.imageUrl}
                    alt={restaurant.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  {!restaurant.isOpen && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Badge variant="destructive" className="text-lg">
                        Closed
                      </Badge>
                    </div>
                  )}

                  <Badge className="absolute top-3 left-3 bg-primary/90 border-0">
                    {highlight(restaurant.cuisine, searchData?.query || "")}
                  </Badge>
                </div>

                <CardContent className="pt-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-lg mb-1">
                      {highlight(restaurant.name, searchData?.query || "")}
                    </h3>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{restaurant.isOpen ? "Open now" : "Closed"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>

      {/* Load more */}
      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}

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
