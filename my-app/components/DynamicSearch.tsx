"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import {
  Search, X, Clock, MapPin, Loader2, TrendingUp, Filter, Leaf,
} from "lucide-react";
import {
  useRestaurantList,
  useSearchRestaurants,
  useSearchItems,
} from "@/lib/api/hooks/useCatalog";
import { cuisineLabel, type CuisineType } from "@/lib/api/adapters/restaurant";
import { ApiError } from "@/lib/api/errors/ApiError";
import { ImageWithFallback } from "@/figma/ImageWithFallback";

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

const DIETARY_TAGS = ["VEG", "NON_VEG", "VEGAN", "EGG", "HALAL"] as const;
const DIETARY_LABELS: Record<(typeof DIETARY_TAGS)[number], string> = {
  VEG: "Veg",
  NON_VEG: "Non-veg",
  VEGAN: "Vegan",
  EGG: "Egg",
  HALAL: "Halal",
};

// Popular searches shown when input is empty
const POPULAR = ["Pizza", "Sushi", "Burger", "Indian", "Chinese", "Italian"];

const MAX_QUERY_LENGTH = 120;
const DEBOUNCE_MS = 300;

type Tab = "restaurants" | "items";

export function DynamicSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [debouncedQuery, setDebouncedQuery] = useState(query.trim());
  const [tab, setTab] = useState<Tab>("restaurants");
  // Seeded from `?cuisine=` so the Home page's cuisine tiles actually land on a filtered
  // list. Previously only `?q=` was read, so those tiles navigated here and the parameter
  // was silently dropped — every tile showed the same unfiltered results. Validated against
  // CUISINE_TYPES because the value is user-editable in the URL.
  const cuisineParam = searchParams.get("cuisine");
  const [selectedCuisine, setSelectedCuisine] = useState<CuisineType | "All">(
    CUISINE_TYPES.includes(cuisineParam as CuisineType) ? (cuisineParam as CuisineType) : "All",
  );
  const [selectedDietary, setSelectedDietary] = useState<(typeof DIETARY_TAGS)[number] | "All">(
    "All",
  );
  const [onlyOpen, setOnlyOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce the query before it drives the server call/URL update.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    router.replace(`/search?${params.toString()}`, { scroll: false });
  }, [debouncedQuery, router]);

  const hasQuery = debouncedQuery.length > 0;

  // Empty search box + a chosen cuisine = browse that cuisine (no text term).
  // Search needs a query (`q` is required), so we fall back to the catalog
  // browse list, which filters by cuisine without a term. Same page shape and
  // adapter as search, so the results grid below renders it transparently.
  const browseMode = tab === "restaurants" && !hasQuery && selectedCuisine !== "All";

  const restaurantsQuery = useSearchRestaurants({
    query: debouncedQuery,
    cuisineTypes: selectedCuisine === "All" ? undefined : [selectedCuisine],
    isOpenNow: onlyOpen ? true : undefined,
  });

  const browseQuery = useRestaurantList(
    {
      cuisineTypes: selectedCuisine === "All" ? undefined : [selectedCuisine],
      isOpen: onlyOpen ? true : undefined,
    },
    { enabled: browseMode },
  );

  const itemsQuery = useSearchItems({
    query: debouncedQuery,
    dietary: selectedDietary === "All" ? undefined : [selectedDietary],
    isAvailable: onlyOpen ? true : undefined,
  });

  const restaurantSource = browseMode ? browseQuery : restaurantsQuery;
  const active = tab === "restaurants" ? restaurantSource : itemsQuery;
  const { isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    active;

  const restaurants = useMemo(
    () => restaurantSource.data?.pages.flatMap((page) => page.items) ?? [],
    [restaurantSource.data],
  );
  const items = useMemo(
    () => itemsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [itemsQuery.data],
  );

  const resultCount = tab === "restaurants" ? restaurants.length : items.length;
  // Whether to render the results region (header/loading/grid): either a text
  // search is active, or we're browsing a cuisine from an empty box.
  const showResults = hasQuery || browseMode;

  const clearQuery = () => {
    setQuery("");
    inputRef.current?.focus();
  };

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
              onChange={(e) => setQuery(e.target.value.slice(0, MAX_QUERY_LENGTH))}
              maxLength={MAX_QUERY_LENGTH}
              placeholder="Search restaurants or menu items..."
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
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={tab === "restaurants" ? "default" : "outline"}
          onClick={() => setTab("restaurants")}
        >
          Restaurants
        </Button>
        <Button
          size="sm"
          variant={tab === "items" ? "default" : "outline"}
          onClick={() => setTab("items")}
        >
          Menu Items
        </Button>
      </div>

      {/* Popular searches — shown when query is empty and not browsing a cuisine */}
      <AnimatePresence>
        {!hasQuery && !browseMode && (
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

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-2 shadow-md">
          <CardContent className="pt-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {tab === "restaurants" ? "Filter by Cuisine" : "Filter by Dietary"}
              </span>
            </div>

            {tab === "restaurants" ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={selectedCuisine === "All" ? "default" : "outline"}
                  onClick={() => setSelectedCuisine("All")}
                >
                  All
                </Button>
                {CUISINE_TYPES.map((cuisine) => (
                  <Button
                    key={cuisine}
                    size="sm"
                    variant={selectedCuisine === cuisine ? "default" : "outline"}
                    onClick={() => setSelectedCuisine(cuisine)}
                  >
                    {cuisineLabel(cuisine)}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={selectedDietary === "All" ? "default" : "outline"}
                  onClick={() => setSelectedDietary("All")}
                >
                  All
                </Button>
                {DIETARY_TAGS.map((tag) => (
                  <Button
                    key={tag}
                    size="sm"
                    variant={selectedDietary === tag ? "default" : "outline"}
                    onClick={() => setSelectedDietary(tag)}
                  >
                    {DIETARY_LABELS[tag]}
                  </Button>
                ))}
              </div>
            )}

            <div
              className="flex items-center gap-3 cursor-pointer select-none"
              onClick={() => setOnlyOpen((v) => !v)}
            >
              <div
                className={`h-5 w-9 rounded-full transition-colors relative ${onlyOpen ? "bg-primary" : "bg-muted"}`}
              >
                <div
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${onlyOpen ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </div>
              <span className="text-sm">
                {tab === "restaurants" ? "Open now only" : "Available only"}
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Results header */}
      {!isLoading && showResults && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{resultCount}</span>{" "}
            {browseMode ? (
              <>
                {resultCount === 1 ? "restaurant" : "restaurants"} in{" "}
                {cuisineLabel(selectedCuisine as CuisineType)}
              </>
            ) : (
              <>results for &quot;{debouncedQuery}&quot;</>
            )}
          </p>
        </div>
      )}

      {/* Loading */}
      {isLoading && showResults && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {isError && showResults && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center">
            <p className="text-lg text-destructive mb-4">Error loading results</p>
            <p className="text-sm text-muted-foreground mb-4">
              {error instanceof ApiError ? error.message : "Failed to fetch search results"}
            </p>
            <Button onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {/* No results */}
      {!isLoading && !isError && showResults && resultCount === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="border-2 border-dashed">
            <CardContent className="py-16 text-center">
              <Search className="h-14 w-14 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold text-lg mb-2">No results found</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Try a different search or adjust your filters
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setSelectedCuisine("All");
                  setSelectedDietary("All");
                  setOnlyOpen(false);
                }}
              >
                Clear search
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Restaurant results */}
      {!isLoading && tab === "restaurants" && resultCount > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {restaurants.map((r, i) => (
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
                      src={r.imageUrl}
                      alt={r.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <Badge
                      className={`absolute top-3 left-3 ${r.isOpen ? "bg-green-500/90" : "bg-red-500/90"} text-white border-0`}
                    >
                      {r.isOpen ? "Open" : "Closed"}
                    </Badge>
                  </div>
                  <CardContent className="pt-4 pb-4 space-y-2">
                    <h3 className="font-semibold leading-tight line-clamp-1">{r.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {r.cuisine && (
                        <Badge variant="secondary" className="text-xs">
                          {r.cuisine}
                        </Badge>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {r.isOpen ? "Open now" : "Closed"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Item results */}
      {!isLoading && tab === "items" && resultCount > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {items.map((item, i) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
              >
                <Card
                  className={`overflow-hidden border-2 shadow-md hover:shadow-xl transition-all cursor-pointer group ${
                    !item.isAvailable ? "opacity-60" : ""
                  }`}
                  onClick={() => router.push(`/restaurants/${item.restaurantId}`)}
                >
                  <div className="relative h-44 overflow-hidden">
                    <ImageWithFallback
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {item.isVegetarian && (
                      <Badge className="absolute top-3 left-3 bg-green-600/90 text-white border-0 gap-1">
                        <Leaf className="h-3 w-3" /> Veg
                      </Badge>
                    )}
                    {!item.isAvailable && (
                      <Badge className="absolute top-3 right-3 bg-black/70 text-white border-0">
                        Unavailable
                      </Badge>
                    )}
                  </div>
                  <CardContent className="pt-4 pb-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-tight line-clamp-1">{item.name}</h3>
                      <span className="text-sm font-medium shrink-0">{item.formattedPrice}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {item.restaurantName}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Load more */}
      {hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
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
    </div>
  );
}
