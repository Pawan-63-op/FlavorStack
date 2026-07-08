import type { OwnerRestaurantView } from "../adapters/restaurantOwner";
import type { OwnerMenuItemView } from "../adapters/menuOwner";

/**
 * Client-tracked owner catalog registry (Batch 10.2).
 *
 * server_2 exposes **no owner-scoped list/detail endpoint**: the only restaurant
 * GET (`/catalog/restaurants/:id`) reads the public `restaurant_summary`
 * projection — it returns the *flattened* summary and 404s for non-PUBLIC /
 * non-ACTIVE restaurants (Batch 10.0 §4, corrected). The FULL owner restaurant /
 * menu-item state (address, categories, zones, variants, version) is therefore
 * only ever returned by the **write** endpoints.
 *
 * So — like Phase 7's tracked orders — we persist each write's adapted view
 * locally and treat it as the owner's working set. Each mutation upserts its
 * returned view here; the query hooks read straight from it. Local-only, never
 * synced; clearing storage loses the working set (documented limitation).
 * Views carry `ownerId`, so listing filters by the signed-in user.
 */
export interface OwnerCatalogRegistry {
  restaurants: Record<string, OwnerRestaurantView>;
  /** Keyed restaurantId → itemId → item view. */
  items: Record<string, Record<string, OwnerMenuItemView>>;
}

const STORAGE_KEY = "owner-catalog-registry";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function emptyRegistry(): OwnerCatalogRegistry {
  return { restaurants: {}, items: {} };
}

function read(): OwnerCatalogRegistry {
  if (!canUseStorage()) return emptyRegistry();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyRegistry();
    const parsed = JSON.parse(raw) as Partial<OwnerCatalogRegistry>;
    return {
      restaurants: parsed.restaurants ?? {},
      items: parsed.items ?? {},
    };
  } catch {
    return emptyRegistry();
  }
}

function write(registry: OwnerCatalogRegistry): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
  } catch {
    /* quota / serialization failure — non-fatal, working set is best-effort */
  }
}


/**
 * All tracked restaurant snapshots, newest-updated first by insertion order.
 * Pass `ownerId` to scope to the signed-in user (snapshots carry `ownerId`).
 */
export function getOwnerRestaurants(ownerId?: string): OwnerRestaurantView[] {
  const all = Object.values(read().restaurants);
  return ownerId ? all.filter((r) => r.ownerId === ownerId) : all;
}

export function getOwnerRestaurant(id: string): OwnerRestaurantView | undefined {
  return read().restaurants[id];
}

export function upsertOwnerRestaurant(view: OwnerRestaurantView): void {
  const registry = read();
  registry.restaurants[view.id] = view;
  write(registry);
}

/** Remove a restaurant snapshot and any tracked items beneath it. */
export function removeOwnerRestaurant(id: string): void {
  const registry = read();
  delete registry.restaurants[id];
  delete registry.items[id];
  write(registry);
}


export function getOwnerItems(restaurantId: string): OwnerMenuItemView[] {
  return Object.values(read().items[restaurantId] ?? {});
}

export function getOwnerItem(
  restaurantId: string,
  itemId: string,
): OwnerMenuItemView | undefined {
  return read().items[restaurantId]?.[itemId];
}

export function upsertOwnerItem(view: OwnerMenuItemView): void {
  const registry = read();
  const bucket = registry.items[view.restaurantId] ?? {};
  bucket[view.id] = view;
  registry.items[view.restaurantId] = bucket;
  write(registry);
}

export function removeOwnerItem(restaurantId: string, itemId: string): void {
  const registry = read();
  const bucket = registry.items[restaurantId];
  if (!bucket) return;
  delete bucket[itemId];
  registry.items[restaurantId] = bucket;
  write(registry);
}
