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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Edit,
  Trash2,
  MapPin,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  useOwnerRestaurants,
  useCreateRestaurant,
  useUpdateRestaurant,
  useDeleteRestaurant,
  useRestaurantLifecycle,
  useSetVisibility,
  useUploadRestaurantImage,
} from "@/lib/api/hooks/useOwnerCatalog";
import { CATALOG_VISIBILITIES, type CatalogVisibility } from "@/lib/api/adapters/restaurantOwner";
import type { OwnerRestaurantView } from "@/lib/api";
import {
  RestaurantForm,
  emptyRestaurantFormValues,
  restaurantErrorMessage,
  type RestaurantFormValues,
} from "./restaurant/RestaurantForm";
import { CategoryEditor } from "./restaurant/CategoryEditor";
import { OpeningHoursEditor } from "./restaurant/OpeningHoursEditor";
import { DeliveryZoneEditor } from "./restaurant/DeliveryZoneEditor";

/** UI form values → server owner-write body fields (Phase-10.md Batch 10.0 contract). */
function toApiFields(values: RestaurantFormValues) {
  return {
    name: values.name,
    slug: values.slug || undefined,
    description: values.description || undefined,
    cuisineTypes: values.cuisineTypes,
    address: {
      label: values.addressLabel || undefined,
      street: values.street,
      city: values.city,
      state: values.state,
      pinCode: values.pinCode,
      coordinates: { lat: values.lat, lng: values.lng },
    },
    location: { lat: values.lat, lng: values.lng },
    phone: values.phone,
  };
}

function fromOwnerView(restaurant: OwnerRestaurantView): RestaurantFormValues {
  return {
    name: restaurant.name,
    slug: restaurant.slug,
    description: restaurant.description ?? "",
    cuisineTypes: restaurant.cuisineTypes,
    street: restaurant.address.street,
    city: restaurant.address.city,
    state: restaurant.address.state,
    pinCode: restaurant.address.pinCode,
    addressLabel: restaurant.address.label ?? "",
    lat: restaurant.location.lat,
    lng: restaurant.location.lng,
    phone: restaurant.phone,
  };
}

const NEXT_STATUS_ACTION: Record<string, { action: "publish" | "pause" | "close"; label: string; icon: typeof Play }[]> = {
  DRAFT: [{ action: "publish", label: "Publish", icon: Play }],
  ACTIVE: [
    { action: "pause", label: "Pause", icon: Pause },
    { action: "close", label: "Close", icon: XCircle },
  ],
  PAUSED: [
    { action: "publish", label: "Resume", icon: Play },
    { action: "close", label: "Close", icon: XCircle },
  ],
  CLOSED: [],
};

export function RestaurantManagement() {
  const { data: restaurants, isLoading } = useOwnerRestaurants();
  const createRestaurant = useCreateRestaurant();
  const updateRestaurant = useUpdateRestaurant();
  const deleteRestaurant = useDeleteRestaurant();
  const lifecycle = useRestaurantLifecycle();
  const setVisibility = useSetVisibility();
  const uploadImage = useUploadRestaurantImage();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const restaurantsList = restaurants ?? [];
  const editingRestaurant = editingId ? restaurantsList.find((r) => r.id === editingId) ?? null : null;

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setPendingImageFile(null);
  };

  const handleSubmit = (values: RestaurantFormValues) => {
    const fields = toApiFields(values);

    if (editingRestaurant) {
      updateRestaurant.mutate(
        { id: editingRestaurant.id, input: fields },
        {
          onSuccess: () => {
            toast.success("Restaurant updated");
            if (pendingImageFile) uploadAfterSave(editingRestaurant.id);
            else closeDialog();
          },
          onError: (error) => toast.error(restaurantErrorMessage(error)),
        },
      );
      return;
    }

    createRestaurant.mutate(
      { ...fields, slug: values.slug || undefined },
      {
        onSuccess: (created) => {
          toast.success("Restaurant created");
          if (pendingImageFile) uploadAfterSave(created.id);
          else closeDialog();
        },
        onError: (error) => toast.error(restaurantErrorMessage(error)),
      },
    );
  };

  const uploadAfterSave = (id: string) => {
    if (!pendingImageFile) return closeDialog();
    uploadImage.mutate(
      { id, file: pendingImageFile, contentType: pendingImageFile.type },
      {
        onSuccess: () => {
          toast.success("Image uploaded");
          closeDialog();
        },
        onError: (error) => {
          toast.error(restaurantErrorMessage(error));
          closeDialog();
        },
      },
    );
  };

  const handleDelete = (id: string) => {
    deleteRestaurant.mutate(id, {
      onSuccess: () => toast.success("Restaurant deleted"),
      onError: (error) => toast.error(restaurantErrorMessage(error)),
    });
  };

  const handleLifecycle = (id: string, action: "publish" | "pause" | "close") => {
    lifecycle.mutate(
      { id, action },
      {
        onSuccess: () => toast.success(`Restaurant ${action}ed`),
        onError: (error) => toast.error(restaurantErrorMessage(error)),
      },
    );
  };

  const handleVisibility = (id: string, visibility: CatalogVisibility) => {
    setVisibility.mutate(
      { id, visibility },
      {
        onSuccess: () => toast.success("Visibility updated"),
        onError: (error) => toast.error(restaurantErrorMessage(error)),
      },
    );
  };

  return (
    <div className="space-y-8 mt-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-3xl font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-transparent bg-clip-text">
            Restaurant Management
          </h3>
          <p className="text-muted-foreground mt-1">Manage the restaurants you own</p>
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
        >
          <DialogTrigger asChild>
            <Button
              className="gap-2 rounded-lg shadow-md bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90 transition"
              onClick={() => {
                setEditingId(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add Restaurant
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRestaurant ? "Edit Restaurant" : "Add New Restaurant"}</DialogTitle>
              <DialogDescription>Fill in restaurant details below</DialogDescription>
            </DialogHeader>
            <RestaurantForm
              initial={editingRestaurant ? fromOwnerView(editingRestaurant) : emptyRestaurantFormValues()}
              isEdit={Boolean(editingRestaurant)}
              imageUrl={editingRestaurant?.imageUrl}
              onImageSelected={setPendingImageFile}
              onSubmit={handleSubmit}
              onCancel={closeDialog}
              submitting={createRestaurant.isPending || updateRestaurant.isPending || uploadImage.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-5">
        {isLoading ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">Loading…</p>
          </Card>
        ) : restaurantsList.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">No restaurants found. Add one to begin!</p>
          </Card>
        ) : (
          restaurantsList.map((restaurant) => {
            const isExpanded = expandedId === restaurant.id;
            const actions = NEXT_STATUS_ACTION[restaurant.status] ?? [];
            return (
              <Card
                key={restaurant.id}
                className="border shadow-md rounded-2xl"
                data-testid={`restaurant-card-${restaurant.id}`}
              >
                <CardContent className="pt-6 space-y-4">
                  <div className="flex gap-6 items-start">
                    {restaurant.imageUrl?.startsWith("http") ? (
                      <img
                        src={restaurant.imageUrl}
                        className="w-28 h-28 rounded-xl object-cover shadow-md"
                        alt={restaurant.name}
                      />
                    ) : (
                      <div className="w-28 h-28 rounded-xl bg-muted flex items-center justify-center text-muted-foreground text-xs">
                        No image
                      </div>
                    )}

                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-xl font-semibold">{restaurant.name}</h3>
                        <Badge>{restaurant.status}</Badge>
                        <Select
                          value={restaurant.visibility}
                          onValueChange={(v) => handleVisibility(restaurant.id, v as CatalogVisibility)}
                        >
                          <SelectTrigger className="w-32 h-7 text-xs" aria-label={`Visibility for ${restaurant.name}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATALOG_VISIBILITIES.map((v) => (
                              <SelectItem key={v} value={v}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!restaurant.canPublish && restaurant.status === "DRAFT" && (
                          <span className="text-xs text-muted-foreground">Add an active category to publish</span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {restaurant.address.city}, {restaurant.address.state}
                        </div>
                        <div className="text-muted-foreground">
                          Cuisine: <span className="text-foreground">{restaurant.cuisineTypes.join(", ")}</span>
                        </div>
                        <div className="text-muted-foreground">
                          Categories: <span className="text-foreground">{restaurant.categories.length}</span>
                        </div>
                        <div className="text-muted-foreground">
                          Zones: <span className="text-foreground">{restaurant.deliveryZones.length}</span>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {actions.map(({ action, label, icon: Icon }) => (
                          <Button
                            key={action}
                            size="sm"
                            variant="outline"
                            disabled={action === "publish" && !restaurant.canPublish}
                            onClick={() => handleLifecycle(restaurant.id, action)}
                          >
                            <Icon className="h-3 w-3 mr-1" /> {label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={`Edit ${restaurant.name}`}
                        onClick={() => {
                          setEditingId(restaurant.id);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={`Delete ${restaurant.name}`}
                        onClick={() => handleDelete(restaurant.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={`Expand ${restaurant.name}`}
                        onClick={() => setExpandedId(isExpanded ? null : restaurant.id)}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <Tabs defaultValue="categories" className="border-t pt-4">
                      <TabsList>
                        <TabsTrigger value="categories">Categories</TabsTrigger>
                        <TabsTrigger value="hours">Opening Hours</TabsTrigger>
                        <TabsTrigger value="zones">Delivery Zones</TabsTrigger>
                      </TabsList>
                      <TabsContent value="categories">
                        <CategoryEditor restaurantId={restaurant.id} categories={restaurant.categories} />
                      </TabsContent>
                      <TabsContent value="hours">
                        <OpeningHoursEditor
                          restaurantId={restaurant.id}
                          schedule={restaurant.openingHours?.schedule ?? {}}
                          holidays={restaurant.openingHours?.holidays ?? []}
                        />
                      </TabsContent>
                      <TabsContent value="zones">
                        <DeliveryZoneEditor restaurantId={restaurant.id} zones={restaurant.deliveryZones} />
                      </TabsContent>
                    </Tabs>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
