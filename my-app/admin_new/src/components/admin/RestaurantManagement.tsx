"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Save, MapPin, Star, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  useRestaurantStore,
  type Restaurant,
} from "../../store/restaurantStore";
import { ImageUpload } from "../ImageUpload";
import Image from "next/image";
import { string } from "zod";

export function RestaurantManagement() {
  const restaurants = useRestaurantStore((s) => s.restaurants);
  const addRestaurant = useRestaurantStore((s) => s.addRestaurant);
  const updateRestaurant = useRestaurantStore((s) => s.updateRestaurant);
  const deleteRestaurant = useRestaurantStore((s) => s.deleteRestaurant);
  const fetchRestaurants = useRestaurantStore((s) => s.fetchRestaurants);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const restaurantsList = Array.isArray(restaurants) ? restaurants : [];

  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [isAddingRestaurant, setIsAddingRestaurant] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [restaurantForm, setRestaurantForm] = useState<Partial<Restaurant>>({
    restaurantName: "",
    cuisine: "",
    city: "",
    country: "",
    rating: 4.5,
    deliveryTime: "25-35 min",
    priceRange: "$$",
    isOpen: true,
    imageUrl: "",
  });

  const handleSaveRestaurant = async () => {
    try {
      const formData = new FormData();
      Object.entries(restaurantForm).forEach(([key, val]) =>
        formData.append(key, String(val ?? "")),
      );

      if (imageFile) formData.append("imageFile", imageFile);

      if (editingRestaurant?._id) {
        await updateRestaurant(editingRestaurant._id, formData);
        toast.success("Restaurant updated!");
      } else {
        await addRestaurant(formData);
        toast.success("Restaurant added!");
      }

      fetchRestaurants();
      resetForm();
    } catch (err) {
      toast.error("Failed to save restaurant");
    }
  };

  const handleEditRestaurant = (restaurant: Restaurant) => {
    setEditingRestaurant(restaurant);
    setRestaurantForm({
      restaurantName: restaurant.restaurantName,
      cuisine: restaurant.cuisine,
      city: restaurant.city,
      country: restaurant.country,
      rating: restaurant.rating,
      deliveryTime: restaurant.deliveryTime,
      priceRange: restaurant.priceRange,
      isOpen: restaurant.isOpen,
      imageUrl: restaurant.imageUrl,
    });
    setIsAddingRestaurant(true);
  };

  const handleDeleteRestaurant = async (id: string) => {
    await deleteRestaurant(id);
    toast.success("Restaurant deleted");
  };

  const resetForm = () => {
    setEditingRestaurant(null);
    setIsAddingRestaurant(false);
    setImageFile(null);
    setRestaurantForm({
      restaurantName: "",
      cuisine: "",
      city: "",
      country: "",
      rating: 4.5,
      deliveryTime: "25-35 min",
      priceRange: "$$",
      isOpen: true,
      imageUrl: "",
    });
  };

  return (
    <div className="space-y-8 mt-6">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-3xl font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-transparent bg-clip-text">
            Restaurant Management
          </h3>
          <p className="text-muted-foreground mt-1">
            Add, edit and manage restaurant partners
          </p>
        </div>

        <Dialog open={isAddingRestaurant} onOpenChange={setIsAddingRestaurant}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-lg shadow-md bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90 transition">
              <Plus className="h-4 w-4" /> Add Restaurant
            </Button>
          </DialogTrigger>

          {/* 📌 Stylish Dialog */}
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl bg-background/80 backdrop-blur-xl border border-purple-200">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                {editingRestaurant ? "Edit Restaurant" : "Add New Restaurant"}
              </DialogTitle>
              <DialogDescription>Fill in restaurant details below</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* IMAGE UPLOAD */}
              <ImageUpload
                value={restaurantForm.imageUrl}
                onChange={(file, preview) => {
                  setImageFile(file);
                  setRestaurantForm({ ...restaurantForm, imageUrl: preview || "" });
                }}
                label="Restaurant Image"
              />

              {/* NAME + CUISINE */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Restaurant Name</Label>
                  <Input
                    value={restaurantForm.restaurantName}
                    onChange={(e) =>
                      setRestaurantForm({ ...restaurantForm, restaurantName: e.target.value })
                    }
                    className="rounded-lg"
                  />
                </div>
                <div>
                  <Label>Cuisine</Label>
                  <Input
                    value={restaurantForm.cuisine}
                    onChange={(e) =>
                      setRestaurantForm({ ...restaurantForm, cuisine: e.target.value })
                    }
                    className="rounded-lg"
                  />
                </div>
              </div>

              {/* LOCATION */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>City</Label>
                  <Input
                    value={restaurantForm.city}
                    onChange={(e) =>
                      setRestaurantForm({ ...restaurantForm, city: e.target.value })
                    }
                    className="rounded-lg"
                  />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input
                    value={restaurantForm.country}
                    onChange={(e) =>
                      setRestaurantForm({ ...restaurantForm, country: e.target.value })
                    }
                    className="rounded-lg"
                  />
                </div>
              </div>

              {/* RATING + DELIVERY + PRICE */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Rating</Label>
                  <Input
                    type="number"
                    step="0.1"
                    max="5"
                    min="0"
                    value={restaurantForm.rating}
                    onChange={(e) =>
                      setRestaurantForm({ ...restaurantForm, rating: parseFloat(e.target.value) })
                    }
                    className="rounded-lg"
                  />
                </div>

                <div>
                  <Label>Delivery Time</Label>
                  <Input
                    value={restaurantForm.deliveryTime}
                    onChange={(e) =>
                      setRestaurantForm({ ...restaurantForm, deliveryTime: e.target.value })
                    }
                    className="rounded-lg"
                  />
                </div>

                <div>
                  <Label>Price Range</Label>
                  <Select
                    value={restaurantForm.priceRange}
                    onValueChange={(v:any) =>
                      setRestaurantForm({ ...restaurantForm, priceRange: v })
                    }
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="$">$ - Budget</SelectItem>
                      <SelectItem value="$$">$$ - Moderate</SelectItem>
                      <SelectItem value="$$$">$$$ - Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleSaveRestaurant} className="w-full rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                <Save className="h-4 w-4 mr-2" />
                {editingRestaurant ? "Update Restaurant" : "Save Restaurant"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* RESTAURANT LIST */}
      <div className="grid grid-cols-1 gap-5">
        {restaurantsList.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">No restaurants found. Add one to begin!</p>
          </Card>
        ) : (
          restaurantsList.map((r) => (
            <Card
              key={r._id}
              className="border shadow-md rounded-2xl transition hover:shadow-xl hover:scale-[1.01] bg-background/80 backdrop-blur-md"
            >
              <CardContent className="pt-6">
                <div className="flex gap-6 items-start">

                  {/* IMAGE */}
                  <div className="w-28 h-28 rounded-xl overflow-hidden shadow-md">
                    <img src={(r.imageUrl)} className="object-cover w-full h-full" />
                    {/* <img src="" alt="" /> */}
                  </div>

                  {/* INFO */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold">{r.restaurantName}</h3>

                      <Badge
                        className={r.isOpen ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}
                      >
                        {r.isOpen ? "Open" : "Closed"}
                      </Badge>

                      <Badge className="flex gap-1 items-center bg-yellow-100 text-yellow-700">
                        <Star className="h-3 w-3" />
                        {r.rating}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {r.city}, {r.country}
                      </div>

                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {r.deliveryTime}
                      </div>

                      <div className="text-muted-foreground">
                        Cuisine: <span className="text-foreground">{r.cuisine}</span>
                      </div>

                      <div className="text-muted-foreground">
                        Price: <span className="text-foreground">{r.priceRange}</span>
                      </div>
                    </div>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEditRestaurant(r)}
                      className="rounded-lg"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-lg"
                      onClick={() => handleDeleteRestaurant(r._id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
