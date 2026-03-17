"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { Slider } from "./ui/slider";
import {
  Search, X, Star, Clock, MapPin, SlidersHorizontal,
  ChefHat, Loader2, TrendingUp, Heart,
} from "lucide-react";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useRestaurantStore } from "@/admin_new/src/store/restaurantStore";
import { ImageWithFallback } from "@/figma/ImageWithFallback";

interface Restaurant {
  id: string;
  restaurantName: string;
  cuisine: string;
  rating: number;
  deliveryTime: string;
  image: string;
  city: string;
  country: string;
  priceRange: string;
  isOpen: boolean;
}

const CUISINES = ["All", "Italian", "Japanese", "Mexican", "Chinese", "Indian", "American", "French", "Thai"];
const SORT_OPTIONS = [
  { value: "rating",       label: "Top Rated" },
  { value: "deliveryTime", label: "Fastest" },
  { value: "name",         label: "A–Z" },
];

// Popular searches shown when input is empty
const POPULAR = ["Pizza", "Sushi", "Burger", "Indian", "Chinese", "Italian"];

export function DynamicSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery]               = useState(searchParams.get("q") || "");
  const rawRestaurants  = useRestaurantStore((s) => s.restaurants);
  const fetchFromStore  = useRestaurantStore((s) => s.fetchRestaurants);
  const loading         = useRestaurantStore((s) => s.isLoading);
  const [results, setResults] = useState<Restaurant[]>([]);
  const [showFilters, setShowFilters]   = useState(false);
  const [selectedCuisine, setSelectedCuisine] = useState(searchParams.get("cuisine") || "All");
  const [sortBy, setSortBy]             = useState(searchParams.get("sort") || "rating");
  const [minRating, setMinRating]       = useState(Number(searchParams.get("rating") || 0));
  const [onlyOpen, setOnlyOpen]         = useState(searchParams.get("open") === "true");

  const inputRef = useRef<HTMLInputElement>(null);
  const favorites    = useFavoritesStore((s) => s.favorites);
  const toggleFav    = useFavoritesStore((s) => s.toggleFavorite);
  const isFavorite   = (id: string) => favorites.some((f) => f.id === id);

  // Use store cache — no fetch if data is fresh (<5 min)
  useEffect(() => {
    fetchFromStore();
    inputRef.current?.focus();
  }, []);

  // useMemo so allRestaurants keeps same reference unless rawRestaurants changes
  // Without this: new array every render → infinite useEffect loop
  const allRestaurants: Restaurant[] = useMemo(
    () => rawRestaurants.map((r: any) => ({
      id:             r._id?.toString() || r.id,
      restaurantName: r.restaurantName,
      cuisine:        r.cuisine,
      rating:         r.rating || 0,
      deliveryTime:   r.deliveryTime || "30-40 min",
      image:          r.imageUrl || r.image || "",
      city:           r.city || "",
      country:        r.country || "",
      priceRange:     r.priceRange || "$$",
      isOpen:         r.isOpen !== false,
    })),
    [rawRestaurants]
  );

  // Filter + sort whenever any dependency changes — instant, no debounce needed
  // since filtering is purely in-memory
  // ── Step 1: filter instantly in memory on every keystroke ──────────────────
  useEffect(() => {
    let filtered = [...allRestaurants];
    const q = query.trim().toLowerCase();

    if (q) {
      filtered = filtered.filter(
        (r) =>
          r.restaurantName.toLowerCase().includes(q) ||
          r.cuisine.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q)
      );
    }
    if (selectedCuisine !== "All") {
      filtered = filtered.filter((r) => r.cuisine === selectedCuisine);
    }
    if (minRating > 0) {
      filtered = filtered.filter((r) => r.rating >= minRating);
    }
    if (onlyOpen) {
      filtered = filtered.filter((r) => r.isOpen);
    }

    filtered.sort((a, b) => {
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "deliveryTime") {
        const mins = (t: string) => parseInt(t.split("-")[0]) || 99;
        return mins(a.deliveryTime) - mins(b.deliveryTime);
      }
      return a.restaurantName.localeCompare(b.restaurantName);
    });

    setResults(filtered);
  }, [query, selectedCuisine, sortBy, minRating, onlyOpen, allRestaurants]);

  // ── Step 2: debounce URL update — only after 400ms of no typing ──────────
  // This prevents Next.js from re-rendering the page on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      const q = query.trim().toLowerCase();
      const params = new URLSearchParams();
      if (q)                         params.set("q", q);
      if (selectedCuisine !== "All") params.set("cuisine", selectedCuisine);
      if (sortBy !== "rating")       params.set("sort", sortBy);
      if (minRating > 0)             params.set("rating", String(minRating));
      if (onlyOpen)                  params.set("open", "true");
      router.replace(`/search?${params.toString()}`, { scroll: false });
    }, 400);

    return () => clearTimeout(timer);
  }, [query, selectedCuisine, sortBy, minRating, onlyOpen]);

  const clearQuery = () => { setQuery(""); inputRef.current?.focus(); };

  const activeFilterCount = [
    selectedCuisine !== "All",
    minRating > 0,
    onlyOpen,
    sortBy !== "rating",
  ].filter(Boolean).length;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">

      {/* Search bar */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search restaurants, cuisines, cities..."
              className="pl-10 pr-10 h-12 text-base"
            />
            {query && (
              <Button
                onClick={clearQuery}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            className="h-12 gap-2 relative"
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </motion.div>

      {/* Popular searches — shown when query is empty */}
      <AnimatePresence>
        {!query && !loading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">Popular:</span>
              {POPULAR.map((term) => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className="text-sm px-3 py-1 rounded-full border border-border hover:border-primary hover:text-primary transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Card className="border-2">
              <CardContent className="pt-5 pb-5 space-y-5">
                {/* Cuisine */}
                <div>
                  <p className="text-sm font-medium mb-2">Cuisine</p>
                  <div className="flex flex-wrap gap-2">
                    {CUISINES.map((c) => (
                      <Button
                        key={c}
                        size="sm"
                        variant={selectedCuisine === c ? "default" : "outline"}
                        onClick={() => setSelectedCuisine(c)}
                      >
                        {c}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Sort */}
                <div>
                  <p className="text-sm font-medium mb-2">Sort by</p>
                  <div className="flex gap-2">
                    {SORT_OPTIONS.map((o) => (
                      <Button
                        key={o.value}
                        size="sm"
                        variant={sortBy === o.value ? "default" : "outline"}
                        onClick={() => setSortBy(o.value)}
                      >
                        {o.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Min rating */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Minimum rating</p>
                    <span className="text-sm text-muted-foreground">
                      {minRating > 0 ? `${minRating}+ ⭐` : "Any"}
                    </span>
                  </div>
                  <Slider
                    min={0} max={5} step={0.5}
                    value={[minRating]}
                    onValueChange={([v]) => setMinRating(v)}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Any</span><span>5.0</span>
                  </div>
                </div>

                {/* Open now toggle */}
                <div
                  className="flex items-center gap-3 cursor-pointer select-none"
                  onClick={() => setOnlyOpen((v) => !v)}
                >
                  <div className={`h-5 w-9 rounded-full transition-colors relative ${onlyOpen ? "bg-primary" : "bg-muted"}`}>
                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${onlyOpen ? "translate-x-4" : "translate-x-0.5"}`} />
                  </div>
                  <span className="text-sm">Open now only</span>
                </div>

                {/* Reset */}
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => {
                      setSelectedCuisine("All");
                      setSortBy("rating");
                      setMinRating(0);
                      setOnlyOpen(false);
                    }}
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Clear all filters
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results header */}
      {!loading && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {query
              ? <><span className="font-medium text-foreground">{results.length}</span> results for "{query}"</>
              : <><span className="font-medium text-foreground">{results.length}</span> restaurants</>
            }
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* No results */}
      {!loading && results.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="border-2 border-dashed">
            <CardContent className="py-16 text-center">
              <ChefHat className="h-14 w-14 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold text-lg mb-2">No restaurants found</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Try a different search or adjust your filters
              </p>
              <Button variant="outline" onClick={() => { setQuery(""); setSelectedCuisine("All"); setMinRating(0); setOnlyOpen(false); }}>
                Clear search
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Results grid */}
      {!loading && results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {results.map((r, i) => (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
              >
                <Card
                  className="overflow-hidden border-2 shadow-md hover:shadow-xl transition-all cursor-pointer group"
                  onClick={() => router.push(`/restaurants/${r.id}`)}
                >
                  <div className="relative h-44 overflow-hidden">
                    <ImageWithFallback
                      src={r.image || undefined}
                      alt={r.restaurantName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {/* Rating badge */}
                    <Badge className="absolute top-3 right-3 bg-white/95 text-foreground gap-1 shadow">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      {r.rating.toFixed(1)}
                    </Badge>
                    {/* Open/closed badge */}
                    <Badge
                      className={`absolute top-3 left-3 ${r.isOpen ? "bg-green-500/90" : "bg-red-500/90"} text-white border-0`}
                    >
                      {r.isOpen ? "Open" : "Closed"}
                    </Badge>
                    {/* Heart */}
                    <Button
                      className="absolute bottom-2 right-2 p-1.5 rounded-full bg-white/80 hover:bg-white transition-colors"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await toggleFav({
                          id: r.id,
                          name: r.restaurantName,
                          cuisine: r.cuisine,
                          rating: r.rating,
                          deliveryTime: r.deliveryTime,
                          image: r.image,
                          addedAt: Date.now(),
                        });
                      }}
                    >
                      <Heart className={`h-4 w-4 ${isFavorite(r.id) ? "fill-red-500 text-red-500" : "text-gray-500"}`} />
                    </Button>
                  </div>

                  <CardContent className="pt-4 pb-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-tight line-clamp-1">
                        {r.restaurantName}
                      </h3>
                      <span className="text-xs text-muted-foreground shrink-0">{r.priceRange}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="secondary" className="text-xs">{r.cuisine}</Badge>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />{r.deliveryTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />{r.city}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
