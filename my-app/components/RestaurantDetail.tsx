"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Star, ArrowLeft, Plus, Minus, ShoppingCart, MessageSquare, Navigation, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { isEnabled } from "@/lib/config/featureFlags";
import { useGeolocation } from "@/lib/geo/useGeolocation";
import { useServiceability } from "@/lib/api/hooks/useCatalog";
import { ImageWithFallback } from "@/figma/ImageWithFallback";
import { toast } from "sonner";
import { useAddToCart, useClearCart } from "@/lib/api/hooks/useCart";
import { type AddCartItemInput } from "@/lib/api/services/cart";
import { useAuthStore } from "@/store/authStore";
import { useGuestCartStore, type GuestCartLine } from "@/store/guestCartStore";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { RatingSummary } from "@/components/reviews/RatingSummary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useRestaurant,
  useRestaurantMenu,
  useRestaurantRating,
} from "@/lib/api/hooks/useCatalog";
import {
  useRestaurantReviews,
  useRestaurantRating as useReviewsRating,
} from "@/lib/api/hooks/useReviews";
import { type MenuItemViewModel } from "@/lib/api/adapters/menu";
import { ApiError } from "@/lib/api/errors/ApiError";

interface RestaurantDetailProps {
  restaurantId: string | undefined;
  onNavigate: (page: string, data?: any) => void;
}

/**
 * Flag-gated ("nearby"), opt-in delivery check. Resolves the user's location on
 * demand, then asks `/catalog/serviceability` whether THIS restaurant delivers
 * there (matched by `restaurantId`) and shows the resolved fee / min order.
 * Renders nothing unless the flag is on; never fetches until the user clicks.
 */
function ServiceabilityResult({
  restaurantId,
  lat,
  lng,
}: {
  restaurantId: string;
  lat: number;
  lng: number;
}) {
  const { data, isLoading } = useServiceability(lat, lng);

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking delivery...
      </span>
    );
  }

  const match = data?.find((s) => s.restaurantId === restaurantId);
  if (!match) {
    return <Badge variant="destructive">Not deliverable to your location</Badge>;
  }

  return (
    <Badge className="bg-green-600 hover:bg-green-600 text-white">
      Delivers to you · {match.formattedDeliveryFee} fee · min {match.formattedMinOrder}
    </Badge>
  );
}

function ServiceabilityCheck({ restaurantId }: { restaurantId: string }) {
  const { coords, status, error, request } = useGeolocation();

  if (coords) {
    return <ServiceabilityResult restaurantId={restaurantId} lat={coords.lat} lng={coords.lng} />;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        size="sm"
        variant="secondary"
        onClick={request}
        disabled={status === "prompting"}
        className="gap-2"
      >
        {status === "prompting" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Locating...
          </>
        ) : (
          <>
            <Navigation className="h-4 w-4" /> Check delivery to my location
          </>
        )}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

export default function RestaurantDetail({ restaurantId, onNavigate }: RestaurantDetailProps) {
  const id = restaurantId ?? "";
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("All");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState("menu");

  const addToCart = useAddToCart();
  const clearCart = useClearCart();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const addGuestLine = useGuestCartStore((s) => s.addLine);
  const replaceGuestCart = useGuestCartStore((s) => s.replaceWith);
  const {
    data: restaurant,
    isLoading: isRestaurantLoading,
    isError: isRestaurantError,
    error: restaurantError,
  } = useRestaurant(id);
  const { data: menu, isLoading: isMenuLoading } = useRestaurantMenu(id);
  const { data: rating } = useRestaurantRating(id);

  // Reviews tab (Batch 9.3): aggregate rating + distribution and the
  // offset-paginated approved-reviews list, both `reviews`-flag-gated.
  const { data: reviewsRating } = useReviewsRating(id);
  const reviewsQuery = useRestaurantReviews(id);
  const reviewItems = reviewsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const categories = useMemo(() => menu?.categories ?? [], [menu]);

  const filteredItems = useMemo<MenuItemViewModel[]>(() => {
    if (selectedCategoryId === "All") {
      return categories.flatMap((category) => category.items);
    }
    return categories.find((category) => category.id === selectedCategoryId)?.items ?? [];
  }, [categories, selectedCategoryId]);

  const handleAddToCart = async (item: MenuItemViewModel) => {
    if (!item.isAvailable || !restaurant) return;
    const quantity = quantities[item.id] || 1;
    // `unitPriceMinor` is the server wire shape ({amount: integer minor units,
    // currency}); the server trusts this client-supplied price (no catalog ACL
    // yet) and re-prices on read via its own projection.
    const input: AddCartItemInput = {
      restaurantId: restaurant.id,
      menuItemId: item.id,
      quantity,
      unitPrice: item.unitPriceMinor,
    };

    const succeed = () => {
      toast.success(`${item.name} × ${quantity} added to cart!`);
      setQuantities({ ...quantities, [item.id]: 1 });
    };

    // Logged out: stage into the local guest buffer (merged into the server
    // cart on login). Mirrors the authed single-restaurant conflict prompt.
    if (!isAuthenticated) {
      const guestLine: GuestCartLine = {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        menuItemId: item.id,
        quantity,
        unitPrice: item.unitPriceMinor,
        name: item.name,
        image: item.imageUrl,
      };
      const result = addGuestLine(guestLine);
      if (!result.ok) {
        const startNew = window.confirm(
          "Your cart has items from another restaurant. Start a new cart with this item?",
        );
        if (!startNew) return;
        replaceGuestCart(guestLine);
      }
      succeed();
      return;
    }

    try {
      await addToCart.mutateAsync(input);
      succeed();
    } catch (err) {
      // The server cart holds items from a single restaurant. A 409 means this
      // item is from a different restaurant than the active cart — offer to
      // clear and start fresh, then retry the same line.
      if (err instanceof ApiError && err.category === "conflict") {
        const startNew = window.confirm(
          "Your cart has items from another restaurant. Start a new cart with this item?",
        );
        if (!startNew) return;
        try {
          await clearCart.mutateAsync();
          await addToCart.mutateAsync(input);
          succeed();
        } catch (retryErr) {
          toast.error(retryErr instanceof ApiError ? retryErr.message : "Could not add to cart");
        }
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Could not add to cart");
    }
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(1, (prev[itemId] || 1) + delta)
    }));
  };

  const isLoading = isRestaurantLoading || isMenuLoading;

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg text-muted-foreground">Loading restaurant details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (isRestaurantError || !restaurant) {
    const message =
      restaurantError instanceof ApiError ? restaurantError.message : "Restaurant not found";
    return (
      <div className="w-full max-w-7xl mx-auto p-8">
        <Button variant="ghost" onClick={() => onNavigate("restaurants", {})} className="gap-2 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Restaurants
        </Button>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-lg text-destructive mb-4">Error loading restaurant</p>
              <p className="text-sm text-muted-foreground mb-4">{message}</p>
              <Button onClick={() => onNavigate("restaurants", {})}>Back to Restaurants</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => onNavigate("restaurants", {})} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Restaurants
      </Button>

      {/* Restaurant Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="overflow-hidden border-2 shadow-lg">
          <div className="relative h-64 overflow-hidden">
            <ImageWithFallback
              src={restaurant.imageUrl}
              alt={restaurant.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-6 left-6 text-white">
              <h1 className="text-4xl font-bold mb-2 text-white">{restaurant.name}</h1>
              <div className="flex items-center gap-4 text-sm">
                <Badge className="bg-white/90 text-foreground hover:bg-white">
                  <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                  {(rating?.avgRating ?? 0).toFixed(1)} ({rating?.reviewCount ?? 0} reviews)
                </Badge>
                <span className="text-white/90">{restaurant.cuisine}</span>
                {!restaurant.isOpen && (
                  <Badge variant="destructive">Closed</Badge>
                )}
              </div>
              {isEnabled("nearby") && (
                <div className="mt-3">
                  <ServiceabilityCheck restaurantId={restaurant.id} />
                </div>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Tabs for Menu and Reviews */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="reviews">
            Reviews ({rating?.reviewCount ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="space-y-6 mt-6">
          {/* Category Filter */}
          {categories.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-2 shadow-md">
                <CardContent className="pt-6">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedCategoryId === "All" ? "default" : "outline"}
                      onClick={() => setSelectedCategoryId("All")}
                    >
                      All
                    </Button>
                    {categories.map((category) => (
                      <Button
                        key={category.id}
                        variant={selectedCategoryId === category.id ? "default" : "outline"}
                        onClick={() => setSelectedCategoryId(category.id)}
                      >
                        {category.label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Menu Items */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Menu</h2>
            {filteredItems.length > 0 ? (
              filteredItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="border-2 shadow-md hover:shadow-lg transition-all">
                    <CardContent className="pt-6">
                      <div className="flex gap-4">
                        <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden">
                          <ImageWithFallback
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-lg font-semibold">{item.name}</h3>
                                {item.isVegetarian && (
                                  <Badge variant="secondary" className="text-xs">
                                    🌱 Veg
                                  </Badge>
                                )}
                                {!item.isAvailable && (
                                  <Badge variant="destructive" className="text-xs">
                                    Unavailable
                                  </Badge>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-sm text-muted-foreground mb-2">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold mb-3">{item.formattedPrice}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 border rounded-lg">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={!item.isAvailable}
                                onClick={() => updateQuantity(item.id, -1)}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-8 text-center font-medium">
                                {quantities[item.id] || 1}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={!item.isAvailable}
                                onClick={() => updateQuantity(item.id, 1)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            <Button
                              onClick={() => handleAddToCart(item)}
                              disabled={!item.isAvailable || addToCart.isPending}
                              className="gap-2"
                            >
                              <ShoppingCart className="h-4 w-4" />
                              Add to Cart
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            ) : (
              <Card className="border-2">
                <CardContent className="pt-12 pb-12 text-center">
                  <p className="text-muted-foreground">No menu items available</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-6 mt-6">
          {isEnabled("reviews") && reviewItems.length > 0 ? (
            <>
              <RatingSummary rating={reviewsRating} />
              <div className="space-y-4">
                {reviewItems.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </div>
              {reviewsQuery.hasNextPage && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => reviewsQuery.fetchNextPage()}
                    disabled={reviewsQuery.isFetchingNextPage}
                  >
                    {reviewsQuery.isFetchingNextPage ? "Loading…" : "Load more reviews"}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              {isEnabled("reviews") && <RatingSummary rating={reviewsRating} />}
              <Card className="border-2 border-dashed">
                <CardContent className="pt-12 pb-12 text-center">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">No reviews yet</h3>
                  <p className="text-muted-foreground">
                    Be the first to review this restaurant!
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
