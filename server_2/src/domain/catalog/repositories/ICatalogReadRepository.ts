import { CuisineType } from '../enums/cuisine-type.enum';
import { CursorPage, CursorPaginationParams } from '../types/CursorPagination';
import {
  MenuItemDetailView,
  MenuItemView,
  RestaurantMenuView,
  RestaurantSummaryView,
} from '../types/ReadModels';

export interface ListRestaurantsFilter {
  cuisineTypes?: CuisineType[];
  isOpen?: boolean;
  /** Restrict the page to these ids (browse's `deliverableOnly` intersection). */
  restaurantIds?: string[];
}

export interface ICatalogReadRepository {
  getRestaurantSummary(restaurantId: string): Promise<RestaurantSummaryView | null>;
  getRestaurantSummaryBySlug(slug: string): Promise<RestaurantSummaryView | null>;
  listRestaurantSummaries(
    filter: ListRestaurantsFilter,
    params: CursorPaginationParams
  ): Promise<CursorPage<RestaurantSummaryView>>;
  getRestaurantMenu(restaurantId: string): Promise<RestaurantMenuView | null>;
  /** The single-item read: `MenuItemView` plus its variant groups. */
  getMenuItemView(itemId: string): Promise<MenuItemDetailView | null>;
  getItemsSnapshot(itemIds: string[]): Promise<MenuItemView[]>;
}
