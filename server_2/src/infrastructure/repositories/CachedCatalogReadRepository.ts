// CachedCatalogReadRepository — cache-aside decorator over the projection-driven
// read repository (Phase 13). Transparent: implements ICatalogReadRepository so the
// query use-cases are unchanged. Hot reads (per-restaurant summary, full menu view,
// browse lists) are served from Redis via CatalogCache; everything else passes
// straight through to the inner Mongo repository.
//
// Not cached (intentional):
//   • getItemsSnapshot — the Cart/Order price-snapshot contract must read the live
//     projection so a placed order always snapshots current truth.
//   • getMenuItemView / getRestaurantSummaryBySlug — low-volume lookups; left direct
//     to keep the invalidation surface small (Phase 13 scope = lists + menu view +
//     serviceability + per-restaurant summary).
import {
  ICatalogReadRepository,
  ListRestaurantsFilter,
} from '../../domain/catalog/repositories/ICatalogReadRepository';
import { CursorPage, CursorPaginationParams } from '../../domain/catalog/types/CursorPagination';
import {
  MenuItemView,
  RestaurantMenuView,
  RestaurantSummaryView,
} from '../../domain/catalog/types/ReadModels';
import { CatalogCache } from '../redis/catalog/CatalogCache';

export class CachedCatalogReadRepository implements ICatalogReadRepository {
  constructor(
    private readonly inner: ICatalogReadRepository,
    private readonly cache: CatalogCache
  ) {}

  getRestaurantSummary(restaurantId: string): Promise<RestaurantSummaryView | null> {
    return this.cache.rememberSummary(restaurantId, () => this.inner.getRestaurantSummary(restaurantId));
  }

  getRestaurantSummaryBySlug(slug: string): Promise<RestaurantSummaryView | null> {
    return this.inner.getRestaurantSummaryBySlug(slug);
  }

  listRestaurantSummaries(
    filter: ListRestaurantsFilter,
    params: CursorPaginationParams
  ): Promise<CursorPage<RestaurantSummaryView>> {
    const discriminator = this.listDiscriminator(filter, params);
    return this.cache.rememberList(discriminator, () =>
      this.inner.listRestaurantSummaries(filter, params)
    );
  }

  getRestaurantMenu(restaurantId: string): Promise<RestaurantMenuView | null> {
    return this.cache.rememberMenu(restaurantId, () => this.inner.getRestaurantMenu(restaurantId));
  }

  getMenuItemView(itemId: string): Promise<MenuItemView | null> {
    return this.inner.getMenuItemView(itemId);
  }

  getItemsSnapshot(itemIds: string[]): Promise<MenuItemView[]> {
    return this.inner.getItemsSnapshot(itemIds);
  }

  /** Stable, collision-free key fragment from the list filter + pagination params. */
  private listDiscriminator(filter: ListRestaurantsFilter, params: CursorPaginationParams): string {
    const cuisines = filter.cuisineTypes ? [...filter.cuisineTypes].sort().join(',') : '';
    const isOpen = filter.isOpen === undefined ? '' : String(filter.isOpen);
    return `c=${cuisines}|o=${isOpen}|cur=${params.cursor ?? ''}|lim=${params.limit ?? ''}`;
  }
}
