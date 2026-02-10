"use client";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { Search, MapPin, UtensilsCrossed, Home, User, Receipt, Clock, Star, TrendingUp } from "lucide-react";
import { useState } from "react";
import { ImageWithFallback } from "@/figma/ImageWithFallback";

interface HomePageProps {
  onNavigate: (page: string, data?: any) => void;
}

export function HomePage(){
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"name" | "city" | "country" | "menu">("name");

  const handleSearch = () => {
    if (searchQuery.trim()) {
      //  onNavigate("restaurants", { query: searchQuery, type: searchType });
     router.push(
  `/restaurants?query=${encodeURIComponent(searchQuery)}&type=${encodeURIComponent(searchType)}`
);
    }
  };

  const popularCuisines = [
    { name: "Italian", icon: "🍝", count: 24 },
    { name: "Japanese", icon: "🍣", count: 18 },
    { name: "Mexican", icon: "🌮", count: 15 },
    { name: "Indian", icon: "🍛", count: 21 },
    { name: "Chinese", icon: "🥡", count: 19 },
    { name: "American", icon: "🍔", count: 32 }
  ];

  const featuredRestaurants = [
    {
      id: "6901962bcd549a1d6fd87e24",
      name: "La Tavola Italiana",
      cuisine: "Italian",
      rating: 4.8,
      deliveryTime: "25-35 min",
      image: "https://images.unsplash.com/photo-1559339352-11d035aa65de?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZXN0YXVyYW50JTIwZXh0ZXJpb3J8ZW58MXx8fHwxNzYwMTI1MjU1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      city: "Rome"
    },
    {
      id: "6901962bcd549a1d6fd87e22",
      name: "Tokyo Sushi Bar",
      cuisine: "Japanese",
      rating: 4.9,
      deliveryTime: "30-40 min",
      image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpdGFsaWFuJTIwcmVzdGF1cmFudCUyMGludGVyaW9yfGVufDF8fHx8MTc2MDEyNTI1NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      city: "San Francisco"
    },
    {
      id: "6901962bcd549a1d6fd87e29",
      name: "Paris Pastry House",
      cuisine: "French",
      rating: 4.7,
      deliveryTime: "20-30 min",
      image: "https://images.unsplash.com/photo-1552566626-52f8b828add9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZXhpY2FuJTIwZm9vZCUyMHJlc3RhdXJhbnR8ZW58MXx8fHwxNzYwMTI1MjU2fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      city: "Paris"
    }
  ];

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
  `/restaurants?cuisine=${encodeURIComponent(cuisine.name)}`)
             
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
          <Button variant="outline" onClick={() => router.push("/restaurants")}>
            View All
          </Button>
        </div>
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
                // onClick={() => onNavigate("restaurant", { id: restaurant.id })}
               onClick={() => router.push(`/restaurant/${restaurant.id}`)}
              >
                <div className="relative h-48 overflow-hidden">
                  <ImageWithFallback
                    src={restaurant.image}
                    alt={restaurant.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <Badge className="absolute top-3 right-3 bg-white/90 text-foreground hover:bg-white">
                    <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                    {restaurant.rating}
                  </Badge>
                </div>
                <CardContent className="pt-4 space-y-3">
                  <div>
                    <h3 className="mb-1">{restaurant.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{restaurant.cuisine}</span>
                      <span>•</span>
                      <MapPin className="h-3 w-3" />
                      <span>{restaurant.city}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{restaurant.deliveryTime}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
