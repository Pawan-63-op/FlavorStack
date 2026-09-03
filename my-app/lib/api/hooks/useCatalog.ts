"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { isEnabled } from "../../config/featureFlags";
import { queryKeys } from "../queryKeys";
import {
  catalogService,
  type NearbyParams,
  type RestaurantListParams,
  type SearchItemsParams,
  type SearchRestaurantsParams,
} from "../services/catalog";

/**
 * Catalog query hooks — thin TanStack wrappers over `catalogService`. Cursor
 * lists use `useInfiniteQuery`; `nearby`/`serviceability` are gated behind
 * the `nearby` feature flag (Phase 4 batch 4.4 wires their UI).
 */

export function useRestaurantList(
  params: Omit<RestaurantListParams, "cursor"> = {},
  options: { enabled?: boolean } = {},
) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.catalog.restaurants(), params] as const,
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      catalogService.listRestaurants({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: options.enabled ?? true,
  });
}

export function useRestaurant(id: string) {
  return useQuery({
    queryKey: queryKeys.catalog.restaurant(id),
    queryFn: () => catalogService.getRestaurant(id),
    enabled: Boolean(id),
  });
}

export function useRestaurantMenu(restaurantId: string) {
  return useQuery({
    queryKey: queryKeys.catalog.menu(restaurantId),
    queryFn: () => catalogService.getMenu(restaurantId),
    enabled: Boolean(restaurantId),
  });
}

/**
 * `GET /catalog/items/:id` — the only read that carries `variantGroups`. Disabled by
 * default so the menu list does not fan out one request per row; the variant picker
 * enables it for the single item it opens.
 */
export function useMenuItem(itemId: string | undefined, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.catalog.item(itemId ?? ""),
    queryFn: () => catalogService.getItem(itemId!),
    enabled: Boolean(itemId) && (options.enabled ?? true),
  });
}

export function useRestaurantRating(restaurantId: string) {
  return useQuery({
    queryKey: queryKeys.catalog.rating(restaurantId),
    queryFn: () => catalogService.getRating(restaurantId),
    enabled: Boolean(restaurantId),
  });
}

export function useSearchRestaurants(params: Omit<SearchRestaurantsParams, "cursor">) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.catalog.search(params.query), params] as const,
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      catalogService.searchRestaurants({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: params.query.length > 0,
  });
}

export function useSearchItems(params: Omit<SearchItemsParams, "cursor">) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.catalog.searchItems(params.query), params] as const,
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      catalogService.searchItems({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: params.query.length > 0,
  });
}

export function useNearbyRestaurants(params: Omit<NearbyParams, "cursor">) {
  return useInfiniteQuery({
    queryKey: queryKeys.catalog.nearby(
      params.lat,
      params.lng,
      params.radiusMeters,
      params.deliverableOnly,
    ),
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      catalogService.nearby({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isEnabled("nearby"),
  });
}

export function useServiceability(
  lat: number,
  lng: number,
  subtotalAmount?: number,
  currency?: string,
) {
  return useQuery({
    queryKey: queryKeys.catalog.serviceability(lat, lng, subtotalAmount, currency),
    queryFn: () => catalogService.serviceability({ lat, lng, subtotalAmount, currency }),
    enabled: isEnabled("nearby"),
  });
}

/**
 * The ids of restaurants that deliver to a point (`GET /catalog/deliverable`) — the
 * reachability half of serviceability, with no fee computation. Callers that already
 * have a list (e.g. `/catalog/nearby`) intersect against this; browse instead passes
 * `deliverableOnly` so the server does the intersection.
 */
export function useDeliverableRestaurants(
  coords: { lat: number; lng: number } | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.catalog.deliverable(coords?.lat ?? 0, coords?.lng ?? 0),
    queryFn: () => catalogService.deliverable({ lat: coords!.lat, lng: coords!.lng }),
    enabled: Boolean(coords) && (options.enabled ?? true),
  });
}
