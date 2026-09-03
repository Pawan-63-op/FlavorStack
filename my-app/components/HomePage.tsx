"use client";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { Search, MapPin, UtensilsCrossed, Home, User, Receipt, TrendingUp } from "lucide-react";
import { useState } from "react";
import { ImageWithFallback } from "@/figma/ImageWithFallback";
import { useAddressStore } from "@/store/addressStore";
import { useRestaurantList } from "@/lib/api/hooks/useCatalog";
import { cuisineLabel, type CuisineType } from "@/lib/api/adapters/restaurant";
import { useHydrateAddresses } from "@/lib/api/hooks/useHydrateAddresses";
import { NearbyRestaurants } from "./NearbyRestaurants";
import Link from "next/link";

interface HomePageProps {
  onNavigate: (page: string, data?: any) => void;
}

export function HomePage(){
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"name" | "city" | "country" | "menu">("name");

  const { addresses } = useAddressStore();
  useHydrateAddresses();

  const handleSearch = () => {
    if (searchQuery.trim()) {
      //  onNavigate("restaurants", { query: searchQuery, type: searchType });
   // AFTER
router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  /**
   * Cuisine tiles are derived from the catalog for the same reason the featured cards are.
   *
   * The previous literal was wrong three ways: the counts were invented ("24 places" against a
   * single Italian restaurant); "Japanese", "Indian" and "American" are not members of the
   * server's `CuisineType` enum at all, so those tiles could never match anything; and the
   * `?cuisine=` value was a display label rather than the enum value the API filters on.
   */
  const CUISINE_ICONS: Partial<Record<CuisineType, string>> = {
    NORTH_INDIAN: "🍛", SOUTH_INDIAN: "🥘", CHINESE: "🥡", ITALIAN: "🍝",
    MEXICAN: "🌮", CONTINENTAL: "🍽️", FAST_FOOD: "🍔", BAKERY: "🧁",
    DESSERTS: "🍰", BEVERAGES: "🥤", SEAFOOD: "🦐", STREET_FOOD: "🌯",
  };
  const { data: cuisinePages } = useRestaurantList({ limit: 50 });
  const popularCuisines = Object.entries(
    (cuisinePages?.pages.flatMap((p) => p.items) ?? []).reduce<Record<string, number>>(
      (acc, r) => {
        for (const c of r.cuisineTypes) acc[c] = (acc[c] ?? 0) + 1;
        return acc;
      },
      {},
    ),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([type, count]) => ({
      type: type as CuisineType,
      name: cuisineLabel(type as CuisineType),
      icon: CUISINE_ICONS[type as CuisineType] ?? "🍴",
      count,
    }));

  /**
   * Featured restaurants come from the catalog, not a literal.
   *
   * This block used to be three hardcoded entries whose `id`s were stale Mongo ObjectIds
   * (`6901962bcd549a1d6fd87e24`) left over from an older dataset — the catalog keys on UUIDs,
   * so every card 404'd on `/restaurants/:id`. Reading the real list is what stops that from
   * silently rotting again.
   *
   * Only fields the server actually returns are rendered: `restaurantAdapter` documents that
   * rating / deliveryTime / city are NOT on the summary DTO and must never be fabricated, so
   * the cards show cuisine and open/closed instead of the invented "4.8 ★ / 25-35 min / Rome".
   */
  const { data: featuredPages, isLoading: featuredLoading } = useRestaurantList({ limit: 3 });
  const featuredRestaurants = (featuredPages?.pages[0]?.items ?? []).slice(0, 3);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 p-8 md:p-12 text-white"
      >
        <div className="relative z-10 max-w-2xl">
          <h1 className="mb-4 text-white">Delicious food delivered to your door</h1>
          <p className="mb-8 text-lg text-white/90">
            Order from your favorite restaurants and get it delivered fresh and hot
          </p>

          {/* Search Bar */}
          <Card className="border-2 shadow-xl">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={searchType === "name" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSearchType("name")}
                  >
                    Restaurant Name
                  </Button>
                  <Button
                    variant={searchType === "city" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSearchType("city")}
                  >
                    City
                  </Button>
                  <Button
                    variant={searchType === "country" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSearchType("country")}
                  >
                    Country
                  </Button>
                  <Button
                    variant={searchType === "menu" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSearchType("menu")}
                  >
                    Menu Item
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder={`Search by ${searchType}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                    className="flex-1"
                  />
                  <Button onClick={handleSearch} size="lg" className="gap-2">
                    <Search className="h-5 w-5" />
                    Search
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Nearby (flag-gated: renders nothing unless `nearby` is enabled) */}
      <NearbyRestaurants />

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <Card 
          className="border-2 shadow-lg hover:shadow-xl transition-all cursor-pointer group"
          onClick={() => router.push("/home")}
        >
          <CardContent className="pt-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-primary/10 rounded-full group-hover:scale-110 transition-transform">
                <Home className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div>
              <h3 className="mb-2">Home</h3>
              <p className="text-sm text-muted-foreground">Browse restaurants and menus</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="border-2 shadow-lg hover:shadow-xl transition-all cursor-pointer group"
          onClick={() => router.push("/profile")}
        >
          <CardContent className="pt-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-blue-500/10 rounded-full group-hover:scale-110 transition-transform">
                <User className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <div>
              <h3 className="mb-2">Update Profile</h3>
              <p className="text-sm text-muted-foreground">Manage your account settings</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="border-2 shadow-lg hover:shadow-xl transition-all cursor-pointer group"
          onClick={() => router.push("/orders")}
        >
          <CardContent className="pt-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-green-500/10 rounded-full group-hover:scale-110 transition-transform">
                <Receipt className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div>
              <h3 className="mb-2">Orders</h3>
              <p className="text-sm text-muted-foreground">View order history & track orders</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Saved Addresses */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2>Your Addresses</h2>
          <Link href="/profile/addresses">
            <Button variant="outline" size="sm" className="gap-2">
              <MapPin className="h-4 w-4" /> Manage
            </Button>
          </Link>
        </div>

        {addresses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {addresses.slice(0, 3).map((addr, index) => (
              <motion.div
                key={addr.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 + index * 0.05 }}
              >
                <Link href="/checkout">
                  <Card className={`border-2 shadow-md hover:shadow-lg transition-all cursor-pointer group ${
                    addr.isDefault ? "border-primary/40 bg-primary/5" : ""
                  }`}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-accent rounded-lg shrink-0 group-hover:scale-110 transition-transform">
                          <MapPin className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">{addr.label}</span>
                            {addr.isDefault && (
                              <span className="text-xs text-primary font-medium">Default</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{addr.addressLines}, {addr.city}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{addr.phone}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + addresses.length * 0.05 }}
            >
              <Link href="/profile/addresses">
                <Card className="border-2 border-dashed hover:border-primary/40 transition-all cursor-pointer h-full min-h-[88px]">
                  <CardContent className="pt-4 pb-4 flex items-center gap-3">
                    <div className="p-2 bg-accent rounded-lg shrink-0">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">Add new address</p>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          </div>
        ) : (
          <Link href="/profile/addresses">
            <Card className="border-2 border-dashed hover:border-primary/40 transition-all cursor-pointer">
              <CardContent className="py-8 text-center">
                <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No saved addresses yet</p>
                <p className="text-xs text-primary mt-1">Tap to add one for faster checkout</p>
              </CardContent>
            </Card>
          </Link>
        )}
      </motion.div>

            {/* Popular Cuisines */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="mb-4">Popular Cuisines</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {popularCuisines.map((cuisine, index) => (
            <motion.div
              key={cuisine.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + index * 0.05 }}
            >
              <Card
                className="border-2 shadow-md hover:shadow-lg transition-all cursor-pointer group"
                onClick={() =>  router.push(
  `/search?cuisine=${encodeURIComponent(cuisine.type)}`)
             
              }
               
              >
                <CardContent className="pt-6 text-center space-y-3">
                  <div className="text-4xl group-hover:scale-125 transition-transform">
                    {cuisine.icon}
                  </div>
                  <div>
                    <h4 className="italic">{cuisine.name}</h4>
                    <p className="text-sm text-muted-foreground">{cuisine.count} places</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Featured Restaurants */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2>Featured Restaurants</h2>
          <Button variant="outline" onClick={() => router.push("/search")}>
            View All
          </Button>
        </div>
        {featuredLoading && featuredRestaurants.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="overflow-hidden border-2 shadow-lg">
                <div className="h-48 bg-muted animate-pulse" />
                <CardContent className="pt-4 space-y-3">
                  <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : featuredRestaurants.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground">
              <UtensilsCrossed className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p>No restaurants are published yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredRestaurants.map((restaurant, index) => (
              <motion.div
                key={restaurant.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
              >
                <Card
                  className="overflow-hidden border-2 shadow-lg hover:shadow-xl transition-all cursor-pointer group"
                  onClick={() => router.push(`/restaurants/${restaurant.id}`)}
                >
                  <div className="relative h-48 overflow-hidden">
                    <ImageWithFallback
                      src={restaurant.imageUrl ?? ""}
                      alt={restaurant.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <Badge
                      className={`absolute top-3 right-3 ${
                        restaurant.isOpen
                          ? "bg-white/90 text-foreground hover:bg-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {restaurant.isOpen ? "Open now" : "Closed"}
                    </Badge>
                  </div>
                  <CardContent className="pt-4 space-y-3">
                    <div>
                      <h3 className="mb-1">{restaurant.name}</h3>
                      {restaurant.cuisine ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <UtensilsCrossed className="h-3 w-3" />
                          <span>{restaurant.cuisine}</span>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default HomePage