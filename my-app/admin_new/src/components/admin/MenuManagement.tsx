"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import {
  useOwnerRestaurants,
  useOwnerMenu,
  useAddMenuItem,
  useUpdateMenuItem,
  useRemoveMenuItem,
  useUploadItemImage,
} from "@/lib/api/hooks/useOwnerCatalog";
import type { OwnerMenuItemView } from "@/lib/api";
import {
  MenuItemForm,
  emptyMenuItemFormState,
  menuItemErrorMessage,
  parseTags,
  type MenuItemFormState,
} from "./menu/MenuItemForm";
import { AvailabilityToggle } from "./menu/AvailabilityToggle";
import { VariantGroupEditor } from "./menu/VariantGroupEditor";

/** Group items under their category label; trailing "Uncategorized" bucket for orphans. */
export function groupItemsByCategory(
  items: OwnerMenuItemView[],
  categories: { id: string; label: string }[],
): { id: string; label: string; items: OwnerMenuItemView[] }[] {
  const groups = categories.map((c) => ({
    id: c.id,
    label: c.label,
    items: items.filter((i) => i.categoryId === c.id),
  }));
  const known = new Set(categories.map((c) => c.id));
  const orphans = items.filter((i) => !known.has(i.categoryId));
  if (orphans.length > 0) groups.push({ id: "__uncategorized__", label: "Uncategorized", items: orphans });
  return groups;
}

export function MenuManagement() {
  const { data: ownerRestaurants } = useOwnerRestaurants();
  const restaurants = ownerRestaurants ?? [];

  const [restaurantId, setRestaurantId] = useState<string>("");
  const selectedRestaurant = restaurants.find((r) => r.id === restaurantId) ?? null;
  const categories = selectedRestaurant?.categories ?? [];

  const { data: items, isLoading } = useOwnerMenu(restaurantId);
  const itemsList = items ?? [];

  const addItem = useAddMenuItem();
  const updateItem = useUpdateMenuItem();
  const removeItem = useRemoveMenuItem();
  const uploadImage = useUploadItemImage();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const editingItem = editingId ? itemsList.find((i) => i.id === editingId) ?? null : null;

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setPendingImageFile(null);
  };

  const uploadAfterSave = (itemId: string) => {
    if (!pendingImageFile) return closeDialog();
    uploadImage.mutate(
      { itemId, file: pendingImageFile, contentType: pendingImageFile.type },
      {
        onSuccess: () => {
          toast.success("Image uploaded");
          closeDialog();
        },
        onError: (error) => {
          toast.error(menuItemErrorMessage(error));
          closeDialog();
        },
      },
    );
  };

  const handleSubmit = (values: MenuItemFormState) => {
    const tags = parseTags(values.tagsText);
    if (editingItem) {
      updateItem.mutate(
        {
          itemId: editingItem.id,
          input: {
            categoryId: values.categoryId,
            name: values.name,
            description: values.description || undefined,
            price: values.price,
            currency: editingItem.basePrice.currency ?? undefined,
            tags: tags.length ? tags : undefined,
            dietary: values.dietary,
          },
        },
        {
          onSuccess: () => {
            toast.success("Menu item updated");
            if (pendingImageFile) uploadAfterSave(editingItem.id);
            else closeDialog();
          },
          onError: (error) => toast.error(menuItemErrorMessage(error)),
        },
      );
      return;
    }

    addItem.mutate(
      {
        restaurantId,
        form: {
          categoryId: values.categoryId,
          name: values.name,
          description: values.description || undefined,
          basePrice: values.price,
          tags: tags.length ? tags : undefined,
          dietary: values.dietary,
        },
      },
      {
        onSuccess: (created) => {
          toast.success("Menu item added");
          if (pendingImageFile) uploadAfterSave(created.id);
          else closeDialog();
        },
        onError: (error) => toast.error(menuItemErrorMessage(error)),
      },
    );
  };

  const handleDelete = (itemId: string) => {
    removeItem.mutate(
      { restaurantId, itemId },
      {
        onSuccess: () => toast.success("Menu item deleted"),
        onError: (error) => toast.error(menuItemErrorMessage(error)),
      },
    );
  };

  const formInitial = (item: OwnerMenuItemView | null): MenuItemFormState => {
    if (!item) return emptyMenuItemFormState(categories[0]?.id ?? "");
    return {
      categoryId: item.categoryId,
      name: item.name,
      description: item.description ?? "",
      price: item.basePrice.amount ?? 0,
      dietary: item.dietary,
      tagsText: item.tags.join(", "),
    };
  };

  const groups = groupItemsByCategory(itemsList, categories);

  return (
    <div className="space-y-6 mt-6">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h3 className="text-3xl font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-transparent bg-clip-text">
            Menu Management
          </h3>
          <p className="text-muted-foreground mt-1">Manage items for a restaurant you own</p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={restaurantId} onValueChange={(v) => setRestaurantId(v)}>
            <SelectTrigger className="w-64" aria-label="Select restaurant">
              <SelectValue placeholder="Select a restaurant" />
            </SelectTrigger>
            <SelectContent>
              {restaurants.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90"
            disabled={!selectedRestaurant || categories.length === 0}
            onClick={() => {
              setEditingId(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add Menu Item
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle>
            <DialogDescription>Fill in the item details below</DialogDescription>
          </DialogHeader>
          <MenuItemForm
            initial={formInitial(editingItem)}
            categories={categories}
            isEdit={Boolean(editingItem)}
            imageUrl={editingItem?.imageUrl}
            onImageSelected={setPendingImageFile}
            onSubmit={handleSubmit}
            onCancel={closeDialog}
            submitting={addItem.isPending || updateItem.isPending || uploadImage.isPending}
          />
        </DialogContent>
      </Dialog>

      {!selectedRestaurant ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">Select a restaurant to manage its menu.</p>
        </Card>
      ) : categories.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">
            This restaurant has no categories yet. Add a category under Restaurant Management before creating items.
          </p>
        </Card>
      ) : isLoading ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">Loading…</p>
        </Card>
      ) : itemsList.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">No menu items yet. Add your first item!</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.id} className="space-y-3">
              <h4 className="text-lg font-medium text-muted-foreground">{group.label}</h4>
              {group.items.length === 0 ? (
                <p className="text-sm text-muted-foreground pl-1">No items in this category.</p>
              ) : (
                group.items.map((item) => {
                  const isExpanded = expandedId === item.id;
                  return (
                    <Card key={item.id} className="border shadow-sm rounded-xl" data-testid={`menu-item-${item.id}`}>
                      <CardContent className="pt-5 space-y-3">
                        <div className="flex gap-4 items-start">
                          {item.imageUrl?.startsWith("http") ? (
                            <img src={item.imageUrl} alt={item.name} className="w-20 h-20 rounded-lg object-cover" />
                          ) : (
                            <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs">
                              No image
                            </div>
                          )}

                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{item.name}</span>
                              <span className="text-sm text-muted-foreground">{item.formattedBasePrice}</span>
                              {item.isVegetarian && (
                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">Veg</Badge>
                              )}
                              {item.dietary
                                .filter((d) => d !== "VEG")
                                .map((d) => (
                                  <Badge key={d} variant="outline">
                                    {d.replace(/_/g, " ")}
                                  </Badge>
                                ))}
                            </div>
                            {item.description && (
                              <p className="text-sm text-muted-foreground">{item.description}</p>
                            )}
                            <AvailabilityToggle
                              itemId={item.id}
                              isAvailable={item.isAvailable}
                              outOfStockReason={item.availability.outOfStockReason}
                            />
                          </div>

                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label={`Edit ${item.name}`}
                              onClick={() => {
                                setEditingId(item.id);
                                setDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label={`Delete ${item.name}`}
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label={`Variants for ${item.name}`}
                              onClick={() => setExpandedId(isExpanded ? null : item.id)}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t pt-4">
                            <p className="text-sm font-medium mb-2">Variant groups</p>
                            <VariantGroupEditor
                              itemId={item.id}
                              groups={item.variantGroups}
                              currency={item.basePrice.currency ?? undefined}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
