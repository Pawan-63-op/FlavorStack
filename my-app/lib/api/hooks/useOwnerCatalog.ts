"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../../store/authStore";
import { ApiError } from "../errors/ApiError";
import { queryKeys } from "../queryKeys";
import {
  catalogOwnerService,
} from "../services/catalogOwner";
import type {
  CatalogVisibility,
  CategoryFormValues,
  ManageZoneInput,
  OpeningHoursInput,
  OwnerRestaurantView,
  RestaurantFormValues,
  UpdateCategoryInput,
  UpdateRestaurantInput,
} from "../adapters/restaurantOwner";
import type {
  AvailabilityInput,
  MenuItemFormValues,
  OwnerMenuItemView,
  UpdateMenuItemInput,
  VariantGroupInput,
} from "../adapters/menuOwner";
import {
  getOwnerItems,
  getOwnerRestaurant,
  removeOwnerItem,
  removeOwnerRestaurant,
  upsertOwnerItem,
  upsertOwnerRestaurant,
} from "../ownerCatalog/registry";

/**
 * Owner catalog query + mutation hooks (Batch 10.2) — thin TanStack wrappers
 * over `catalogOwnerService`, backed by the client-tracked registry (server has
 * no owner list/detail endpoint; see `ownerCatalog/registry.ts`).
 *
 * Reads come from the registry; every mutation calls the service, persists the
 * returned view into the registry, then invalidates the affected query keys.
 * Restaurant writes touch the list + that restaurant; menu writes touch that
 * restaurant's menu. 409 conflicts (`isVersionConflict`) bubble to the caller
 * so the UI can refetch-then-retry (Batch 10.0 §8).
 */

/** True for the optimistic-lock 409 the server raises on concurrent writes. */
export function isVersionConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

export function invalidateOwnerRestaurant(qc: QueryClient, id: string): void {
  void qc.invalidateQueries({ queryKey: queryKeys.ownerCatalog.restaurants() });
  void qc.invalidateQueries({ queryKey: queryKeys.ownerCatalog.restaurant(id) });
}

export function invalidateOwnerMenu(qc: QueryClient, restaurantId: string): void {
  void qc.invalidateQueries({ queryKey: queryKeys.ownerCatalog.menu(restaurantId) });
}


/**
 * The signed-in owner's restaurants, fetched from server truth
 * (`GET /catalog/restaurants/mine`). Each result is seeded into the local
 * registry so registry-backed detail/menu reads resolve even for restaurants
 * created on another device or via seed (the registry is now a cache, not the
 * source of truth — see `ownerCatalog/registry.ts`).
 */
export function useOwnerRestaurants() {
  const ownerId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: queryKeys.ownerCatalog.restaurants(),
    queryFn: async () => {
      const restaurants = await catalogOwnerService.listOwnerRestaurants();
      restaurants.forEach(upsertOwnerRestaurant);
      return restaurants;
    },
    enabled: Boolean(ownerId),
  });
}

export function useOwnerRestaurant(id: string) {
  return useQuery({
    queryKey: queryKeys.ownerCatalog.restaurant(id),
    queryFn: () => getOwnerRestaurant(id) ?? null,
    enabled: Boolean(id),
  });
}

export function useOwnerMenu(restaurantId: string) {
  return useQuery({
    queryKey: queryKeys.ownerCatalog.menu(restaurantId),
    queryFn: () => getOwnerItems(restaurantId),
    enabled: Boolean(restaurantId),
  });
}


/** Persist a restaurant view to the registry + refresh the list/detail caches. */
function useRestaurantSync(): (view: OwnerRestaurantView) => void {
  const qc = useQueryClient();
  return (view) => {
    upsertOwnerRestaurant(view);
    qc.setQueryData(queryKeys.ownerCatalog.restaurant(view.id), view);
    invalidateOwnerRestaurant(qc, view.id);
  };
}

export function useCreateRestaurant() {
  const sync = useRestaurantSync();
  return useMutation({
    mutationFn: (form: RestaurantFormValues) => catalogOwnerService.createRestaurant(form),
    onSuccess: sync,
  });
}

export function useUpdateRestaurant() {
  const sync = useRestaurantSync();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRestaurantInput }) =>
      catalogOwnerService.updateRestaurant(id, input),
    onSuccess: sync,
  });
}

export function useDeleteRestaurant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => catalogOwnerService.deleteRestaurant(id),
    onSuccess: (_data, id) => {
      removeOwnerRestaurant(id);
      invalidateOwnerRestaurant(qc, id);
    },
  });
}

export function useRestaurantLifecycle() {
  const sync = useRestaurantSync();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "publish" | "pause" | "close" }) =>
      catalogOwnerService[action](id),
    onSuccess: sync,
  });
}

export function useSetVisibility() {
  const sync = useRestaurantSync();
  return useMutation({
    mutationFn: ({ id, visibility }: { id: string; visibility: CatalogVisibility }) =>
      catalogOwnerService.setVisibility(id, visibility),
    onSuccess: sync,
  });
}

export function useSetOpeningHours() {
  const sync = useRestaurantSync();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: OpeningHoursInput }) =>
      catalogOwnerService.setOpeningHours(id, input),
    onSuccess: sync,
  });
}

export function useUploadRestaurantImage() {
  const sync = useRestaurantSync();
  return useMutation({
    mutationFn: ({ id, file, contentType }: { id: string; file: Blob; contentType?: string }) =>
      catalogOwnerService.uploadRestaurantImage(id, file, contentType),
    onSuccess: sync,
  });
}


export function useAddCategory() {
  const sync = useRestaurantSync();
  return useMutation({
    mutationFn: ({ id, form }: { id: string; form: CategoryFormValues }) =>
      catalogOwnerService.addCategory(id, form),
    onSuccess: sync,
  });
}

export function useReorderCategories() {
  const sync = useRestaurantSync();
  return useMutation({
    mutationFn: ({ id, orderedCategoryIds }: { id: string; orderedCategoryIds: string[] }) =>
      catalogOwnerService.reorderCategories(id, orderedCategoryIds),
    onSuccess: sync,
  });
}

export function useUpdateCategory() {
  const sync = useRestaurantSync();
  return useMutation({
    mutationFn: ({
      id,
      categoryId,
      input,
    }: {
      id: string;
      categoryId: string;
      input: UpdateCategoryInput;
    }) => catalogOwnerService.updateCategory(id, categoryId, input),
    onSuccess: sync,
  });
}

export function useRemoveCategory() {
  const sync = useRestaurantSync();
  return useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string }) =>
      catalogOwnerService.removeCategory(id, categoryId),
    onSuccess: sync,
  });
}

export function useManageZone() {
  const sync = useRestaurantSync();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ManageZoneInput }) =>
      catalogOwnerService.manageZone(id, input),
    onSuccess: sync,
  });
}


/** Persist an item view to the registry + refresh that restaurant's menu cache. */
function useItemSync(): (view: OwnerMenuItemView) => void {
  const qc = useQueryClient();
  return (view) => {
    upsertOwnerItem(view);
    invalidateOwnerMenu(qc, view.restaurantId);
  };
}

export function useAddMenuItem() {
  const sync = useItemSync();
  return useMutation({
    mutationFn: ({ restaurantId, form }: { restaurantId: string; form: MenuItemFormValues }) =>
      catalogOwnerService.addItem(restaurantId, form),
    onSuccess: sync,
  });
}

export function useUpdateMenuItem() {
  const sync = useItemSync();
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: UpdateMenuItemInput }) =>
      catalogOwnerService.updateItem(itemId, input),
    onSuccess: sync,
  });
}

export function useRemoveMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ restaurantId, itemId }: { restaurantId: string; itemId: string }) =>
      catalogOwnerService.removeItem(itemId).then(() => ({ restaurantId, itemId })),
    onSuccess: ({ restaurantId, itemId }) => {
      removeOwnerItem(restaurantId, itemId);
      invalidateOwnerMenu(qc, restaurantId);
    },
  });
}

export function useSetItemAvailability() {
  const sync = useItemSync();
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: AvailabilityInput }) =>
      catalogOwnerService.setAvailability(itemId, input),
    onSuccess: sync,
  });
}

export function useSetItemVariants() {
  const sync = useItemSync();
  return useMutation({
    mutationFn: ({ itemId, groups }: { itemId: string; groups: VariantGroupInput[] }) =>
      catalogOwnerService.setVariants(itemId, groups),
    onSuccess: sync,
  });
}

export function useUploadItemImage() {
  const sync = useItemSync();
  return useMutation({
    mutationFn: ({ itemId, file, contentType }: { itemId: string; file: Blob; contentType?: string }) =>
      catalogOwnerService.uploadItemImage(itemId, file, contentType),
    onSuccess: sync,
  });
}
