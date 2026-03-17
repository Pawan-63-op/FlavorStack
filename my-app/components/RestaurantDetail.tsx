"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { MapPin, Clock, Star, ArrowLeft, Plus, Minus, ShoppingCart, MessageSquare } from "lucide-react";
import { useState, useEffect, Children } from "react";
import { ImageWithFallback } from "@/figma/ImageWithFallback";
import { useCartStore } from "@/admin_new/src/store/cartStore";
import { useReviewStore } from "@/store/reviewStore";
import { StarRating } from "@/components/StarRating";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  isVegetarian: boolean;
  isSpicy: boolean;
  calories: number;
}

interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
restaurantName:string;
  rating: number;
  reviews: number;
  deliveryTime: string;
  deliveryFee: number;
  minOrder: number;
  image: string;
  imageUrl?:string;
  city: string;
  address: string;
}

interface RestaurantDetailProps {
  restaurantId: string | undefined;
  onNavigate: (page: string, data?: any) => void;
}

export default function RestaurantDetail({ restaurantId, onNavigate }: RestaurantDetailProps) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState("menu");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const addToCart = useCartStore((state) => state.addToCart);
  const getRestaurantReviews   = useReviewStore((s) => s.getRestaurantReviews);
  const fetchRestaurantReviews = useReviewStore((s) => s.fetchRestaurantReviews);
  const getAverageRating       = useReviewStore((s) => s.getAverageRating);
  const restaurantReviews      = restaurantId ? getRestaurantReviews(restaurantId as string) : [];

  // Fetch restaurant details from MongoDB
  useEffect(() => {
    const fetchRestaurantDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        // const res = await fetch(`http://localhost:8000/api/restaurants/${restaurantId}`){}
         const res = await fetch(`http://localhost:8000/api/restaurants/${restaurantId}`, {
     
      headers: {
        "Content-Type": "application/json",
      },
        credentials: "include", // 🔥 VERY IMPORTANT
   
    });
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data2 = await res.json();
        const data= data2.restaurant;
        // Format restaurant data
        const formattedRestaurant: Restaurant = {
          id: data._id?.toString() || data.id,
          name: data.name,
          restaurantName: data.restaurantName,
          cuisine: data.cuisine,
          rating: data.rating,
          reviews: data.reviews || 0,
          deliveryTime: data.deliveryTime,
          deliveryFee: data.deliveryFee || 2.99,
          minOrder: data.minOrder || 15,
          imageUrl: data.imageUrl,
          city: data.city,
          image:data.image,
          address: data.address || `${data.city}, ${data.country}`
        };
        
        setRestaurant(formattedRestaurant);
      } catch (error) {
        console.error("Error fetching restaurant:", error);
        setError(error instanceof Error ? error.message : "Failed to fetch restaurant");
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurantDetails();
  }, [restaurantId]);

  // Fetch menu items from MongoDB
  useEffect(() => {
    const fetchMenuItems = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/restaurants/${restaurantId}/menu`, {
     
      headers: {
        "Content-Type": "application/json",
      },
        credentials: "include", // 🔥 VERY IMPORTANT
   
    });
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        
        // Handle different response formats
        let formattedItems = data.menus;
        // console.lo
 
        // if (!Array.isArray(data)) {
        //   if (data.menu && Array.isArray(data.menu)) {
        //     menuData = data.menu;
        //   } else if (data.items && Array.isArray(data.items)) {
        //     menuData = data.items;
        //   } else {
        //     menuData = [];
        //   }
        // }
        
        // Format menu items
        // const formattedItems: MenuItem[] = menuData.map((currrent: any) => ({
        //   item= menuItme.findbyid(current as objectid);
        //   id: item._id?.toString() || item.id,
        //   name: item.name,
        //   description: item.description,
        //   price: item.price,
        //   image: item.image,
        //   category: item.category,
        //   isVegetarian: item.isVegetarian || false,
        //   isSpicy: item.isSpicy || false,
        //   calories: item.calories || 0
        // }));
//         const formattedItems: MenuItem[] = await Promise.all(
//   menuData.map(async (current: any) => {
//     const item = await menuItem.findById(current as ObjectId);
//     return {
//       id: item._id?.toString() || item.id,
//       name: item.name,
//       description: item.description,
//       price: item.price,
//       image: item.image,
//       category: item.category,
//       isVegetarian: item.isVegetarian || false,
//       isSpicy: item.isSpicy || false,
//       calories: item.calories || 0
//     };
//   })
// );
        setMenuItems(formattedItems);
        console.log(menuItems,"menuitems");
        console.log(formattedItems,"menudata");
      } catch (error) {
        console.error("Error fetching menu items:", error);
      }
    };

    if (restaurantId) {
      fetchMenuItems();
    }
  }, [restaurantId]);

  // Fetch real reviews for this restaurant from MongoDB
  useEffect(() => {
    if (restaurantId) {
      fetchRestaurantReviews(restaurantId as string);
    }
  }, [restaurantId]);

  const categories = ["All", ...Array.from(new Set(menuItems.map(item => item.category)))];

  const filteredItems = selectedCategory === "All"
    ? menuItems
    : menuItems.filter(item => item.category === selectedCategory);

  const handleAddToCart = (item: MenuItem) => {
    const quantity = quantities[item.id] || 1;
    if (restaurant) {
      addToCart({
        id: item.id,
        restaurantId: String(restaurant.id),
        restaurantName: restaurant.restaurantName,
        name: item.name,
        price: item.price,
        image: item.image,
        quantity: quantity
      });
    }
    setQuantities({ ...quantities, [item.id]: 1 });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(1, (prev[itemId] || 1) + delta)
    }));
  };

  // Loading state
  if (loading) {
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
  if (error || !restaurant) {
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
              <p className="text-sm text-muted-foreground mb-4">{error || "Restaurant not found"}</p>
              <Button onClick={() => onNavigate("restaurants", {})}>Back to Restaurants</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

// const menuLink = await op(restaurant);
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
              <h1 className="text-4xl font-bold mb-2 text-white">{restaurant.restaurantName}</h1>
              <div className="flex items-center gap-4 text-sm">
                <Badge className="bg-white/90 text-foreground hover:bg-white">
                  <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                  {restaurant.rating} ({restaurant.reviews} reviews)
                </Badge>
                <span className="text-white/90">{restaurant.cuisine}</span>
              </div>
            </div>
          </div>

          <CardContent className="pt-6">
         
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Delivery Time</p>
                  <p className="font-medium">{restaurant.deliveryTime}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Min. Order</p>
                  <p className="font-medium">${restaurant.minOrder}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">{restaurant.city}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs for Menu and Reviews */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="reviews">
            Reviews ({restaurantReviews.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="space-y-6 mt-6">
          {/* Category Filter */}
          {menuItems.length > 0 && (
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
                      >
                        {category}
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
                            src={item.image}
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
                                {item.isSpicy && (
                                  <Badge variant="destructive" className="text-xs">
                                    🌶️ Spicy
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {item.description}
                              </p>
                              {item.calories > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  {item.calories} calories
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold mb-3">${item.price.toFixed(2)}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 border rounded-lg">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
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
                                onClick={() => updateQuantity(item.id, 1)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            <Button
                              onClick={() => handleAddToCart(item)}
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
          {/* Header with average rating */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-2xl font-bold">Customer Reviews</h2>
              <p className="text-sm text-muted-foreground">
                {restaurantReviews.length} review{restaurantReviews.length !== 1 ? "s" : ""}
              </p>
            </div>
            {restaurantReviews.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-accent rounded-xl">
                <StarRating rating={getAverageRating(restaurantId as string)} readonly size="sm" />
                <span className="font-bold text-lg">
                  {getAverageRating(restaurantId as string).toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground">/ 5</span>
              </div>
            )}
          </div>

          {restaurantReviews.length > 0 ? (
            <div className="space-y-4">
              {restaurantReviews.map((review, index) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="border-2 shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex gap-4">
                        <Avatar className="h-12 w-12 shrink-0">
                          <AvatarImage
                            src={`https://api.multiavatar.com/${encodeURIComponent(review.userName || "user")}.svg`}
                          />
                          <AvatarFallback>{review.userName?.charAt(0) || "?"}</AvatarFallback>
                        </Avatar>

                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div>
                              <h4 className="font-semibold">{review.userName}</h4>
                              <span className="text-xs text-muted-foreground">{review.date}</span>
                            </div>
                            <StarRating rating={review.rating} readonly size="sm" />
                          </div>

                          <p className="text-muted-foreground leading-relaxed text-sm">
                            {review.comment}
                          </p>

                          {review.photos && review.photos.length > 0 && (
                            <div className="flex gap-2 flex-wrap mt-2">
                              {review.photos.map((photo, photoIndex) => (
                                <div
                                  key={photoIndex}
                                  className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-border"
                                >
                                  <img
                                    src={photo || undefined}
                                    alt={`Review photo ${photoIndex + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <Card className="border-2 border-dashed">
              <CardContent className="pt-12 pb-12 text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No reviews yet</h3>
                <p className="text-muted-foreground">
                  Be the first to review this restaurant!
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}