/*  
  ⚡ UPGRADED UI VERSION  
  - Glass cards
  - Rounded table rows
  - Highlighted categories
  - Status colors improved
  - Modern spacing & shadows
  - Dialog redesigned
*/
"use client";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { useMenuStore, type MenuItem } from "../../store/menuStore";
import { useRestaurantStore } from "../../store/restaurantStore";
import { ImageUpload } from "../ImageUpload";
import Image from "next/image";

export function MenuManagement() {
  const menuItems = useMenuStore((state) => state.menuItems);
  const addMenuItem = useMenuStore((state) => state.addMenuItem);
  const updateMenuItem = useMenuStore((state) => state.updateMenuItem);
  const deleteMenuItem = useMenuStore((state) => state.deleteMenuItem);
  const fetchMenuItems = useMenuStore((state) => state.fetchMenuItems);
  const restaurants = useRestaurantStore((state) => state.restaurants);

  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [isAddingMenuItem, setIsAddingMenuItem] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  type MenuFormType = {
    name: string;
    description: string;
    price: number;
    category: string;
    isVegetarian: boolean;
    isSpicy: boolean;
    isAvailable: boolean;
    restaurant: string;
    image: string;
  };

  const [menuForm, setMenuForm] = useState<MenuFormType>({
    name: "",
    description: "",
    price: 0,
    category: "Main Course",
    isVegetarian: false,
    isSpicy: false,
    isAvailable: true,
    restaurant: "",
    image: "",
  });

  useEffect(() => {
    fetchMenuItems();
  }, []);

  // --------------------------------------
  // Save / Update Menu Item
  // --------------------------------------

  const handleSaveMenuItem = async () => {
    if (!menuForm.name || !menuForm.description || !menuForm.restaurant) {
      toast.error("Please fill all required fields");
      return;
    }

    const formData = new FormData();
    Object.entries(menuForm).forEach(([key, val]) =>
      formData.append(key, String(val))
    );
    if (imageFile) formData.append("imageFile", imageFile);

    try {
      if (editingMenuItem?._id) {
        await updateMenuItem(editingMenuItem._id, formData);
        toast.success("Menu item updated!");
      } else {
        await addMenuItem(formData);
        toast.success("Menu item added!");
      }
      resetForm();
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleDeleteMenuItem = async (id: string) => {
    await deleteMenuItem(id);
    toast.success("Deleted!");
  };

  const handleEditMenuItem = (menuItem: MenuItem) => {
    setEditingMenuItem(menuItem);
    setMenuForm({
      name: menuItem.name,
      description: menuItem.description,
      price: menuItem.price,
      category: menuItem.category,
      isVegetarian: menuItem.isVegetarian,
      isSpicy: menuItem.isSpicy,
      isAvailable: menuItem.isAvailable,
      restaurant:
        typeof menuItem.restaurant === "string"
          ? menuItem.restaurant
          : menuItem.restaurant?._id || "",
      image: menuItem.image,
    });
    setIsAddingMenuItem(true);
  };

  const resetForm = () => {
    setEditingMenuItem(null);
    setIsAddingMenuItem(false);
    setImageFile(null);
    setMenuForm({
      name: "",
      description: "",
      price: 0,
      category: "Main Course",
      isVegetarian: false,
      isSpicy: false,
      isAvailable: true,
      restaurant: "",
      image: "",
    });
  };

  const restaurantsList = Array.isArray(restaurants) ? restaurants : [];
  const menuItemsList = Array.isArray(menuItems) ? menuItems : [];

  const getRestaurantName = (restaurant: any): string => {
    if (typeof restaurant === "string") {
      return restaurantsList.find((r) => r._id === restaurant)?.restaurantName || "N/A";
    }
    return restaurant?.restaurantName || "N/A";
  };

  // -----------------------------------------
  // Stylish status UI
  // -----------------------------------------

  const statusBadge = (avail: boolean) =>
    avail
      ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
      : "bg-red-100 text-red-700 border border-red-300";

  // -----------------------------------------
  // Render UI
  // -----------------------------------------

  return (
    <div className="space-y-6 mt-6">
      {/* PAGE HEADER */}
      <div className="flex justify-between items-center">
       <h3 className="text-3xl font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-transparent bg-clip-text">
            Menu Management
          </h3>

        <Dialog open={isAddingMenuItem} onOpenChange={setIsAddingMenuItem}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:opacity-90 shadow-lg">
              <Plus className="h-4 w-4" />
              Add Menu Item
            </Button>
          </DialogTrigger>

          {/* Stylish Dialog */}
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-purple-200/30 backdrop-blur-xl bg-background/60">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                {editingMenuItem ? "Edit Menu Item" : "Add Menu Item"}
              </DialogTitle>
              <DialogDescription>
                Fill details below to create or update a menu item.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Image Upload */}
              <ImageUpload value={menuForm.image} onChange={(file, preview) => {
                setImageFile(file);
                setMenuForm({ ...menuForm, image: preview || "" });
              }} />

              {/* Restaurant */}
              <div className="space-y-2">
                <Label>Restaurant *</Label>
                <Select
                  value={menuForm.restaurant}
                  onValueChange={(value:any) =>
                    setMenuForm({ ...menuForm, restaurant: value })
                  }
                >
                  <SelectTrigger className="bg-background/60 backdrop-blur-sm border-purple-200">
                    <SelectValue placeholder="Choose restaurant" />
                  </SelectTrigger>
                  <SelectContent>
                    {restaurantsList.map((r) => (
                      <SelectItem key={r._id} value={r._id}>
                        {r.restaurantName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Name + Category */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Item Name *</Label>
                  <Input
                    value={menuForm.name}
                    onChange={(e) =>
                      setMenuForm({ ...menuForm, name: e.target.value })
                    }
                    className="bg-background/60 backdrop-blur-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select
                    value={menuForm.category}
                    onValueChange={(val:any) =>
                      setMenuForm({ ...menuForm, category: val })
                    }
                  >
                    <SelectTrigger className="bg-background/60 backdrop-blur-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Appetizer">Appetizer</SelectItem>
                      <SelectItem value="Main Course">Main Course</SelectItem>
                      <SelectItem value="Dessert">Dessert</SelectItem>
                      <SelectItem value="Beverage">Beverage</SelectItem>
                      <SelectItem value="Side">Side</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea
                  rows={3}
                  value={menuForm.description}
                  onChange={(e) =>
                    setMenuForm({ ...menuForm, description: e.target.value })
                  }
                  className="bg-background/60 backdrop-blur-sm"
                />
              </div>

              {/* Price */}
              <div className="space-y-2">
                <Label>Price ($) *</Label>
                <Input
                  type="number"
                  value={menuForm.price}
                  onChange={(e) =>
                    setMenuForm({
                      ...menuForm,
                      price: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="bg-background/60 backdrop-blur-sm"
                />
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-3 gap-4 pt-2">
                {[
                  { id: "veg", label: "Vegetarian", key: "isVegetarian" },
                  { id: "spicy", label: "Spicy", key: "isSpicy" },
                  { id: "avail", label: "Available", key: "isAvailable" },
                ].map((opt) => (
                  <div key={opt.id} className="flex items-center space-x-2">
                    <Checkbox
                      checked={(menuForm as any)[opt.key]}
                      onCheckedChange={(checked:any) =>
                        setMenuForm({
                          ...menuForm,
                          [opt.key]: checked as boolean,
                        })
                      }
                    />
                    <Label className="cursor-pointer">{opt.label}</Label>
                  </div>
                ))}
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSaveMenuItem}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90 shadow-lg"
              >
                <Save className="h-4 w-4 mr-2" />
                {editingMenuItem ? "Update Item" : "Save Item"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* TABLE */}
      <Card className="border-2 shadow-xl bg-background/70 backdrop-blur-xl rounded-2xl">
        <CardContent className="pt-6">
          {menuItemsList.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No menu items found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-background-to-r from-purple-50 to-indigo-50">
                  <TableHead>Image</TableHead>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {menuItemsList.map((item) => (
                  <TableRow
                    key={item._id}
                    className="hover:bg-purple-50/50 transition-all"
                  >
                    <TableCell>
                      {item.image && (
                        <Image
                          src={item.image}
                          alt={item.image}
                         height={80}
                         width={90}
                          // className=" rounded-lg object-cover shadow-sm"
                        />
                      )}
                    </TableCell>

                    <TableCell>{getRestaurantName(item.restaurant)}</TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.name}
                        {item.isVegetarian && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">
                            🌱 Veg
                          </Badge>
                        )}
                        {item.isSpicy && (
                          <Badge className="bg-red-100 text-red-600 border-red-300">
                            🌶️ Spicy
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="border-purple-300">
                        {item.category}
                      </Badge>
                    </TableCell>

                    <TableCell>${item.price?.toFixed(2)}</TableCell>

                    <TableCell>
                      <span className={`px-3 py-1 rounded-md text-xs font-medium ${statusBadge(
                        item.isAvailable
                      )}`}>
                        {item.isAvailable ? "Available" : "Unavailable"}
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditMenuItem(item)}
                        >
                          <Edit className="h-4 w-4 text-purple-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteMenuItem(item._id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
