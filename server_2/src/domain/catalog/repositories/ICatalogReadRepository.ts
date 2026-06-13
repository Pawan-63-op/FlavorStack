import { CuisineType } from '../enums/cuisine-type.enum';
import { CursorPage, CursorPaginationParams } from '../types/CursorPagination';
import { MenuItemView, RestaurantMenuView, RestaurantSummaryView } from '../types/ReadModels';

export interface ListRestaurantsFilter {
  cuisineTypes?: CuisineType[];
  isOpen?: boolean;
}

export interface ICatalogReadRepository {
  getRestaurantSummary(restaurantId: string): Promise<RestaurantSummaryView | null>;
  getRestaurantSummaryBySlug(slug: string): Promise<RestaurantSummaryView | null>;
  listRestaurantSummaries(
    filter: ListRestaurantsFilter,
    params: CursorPaginationParams
  ): Promise<CursorPage<RestaurantSummaryView>>;
  getRestaurantMenu(restaurantId: string): Promise<RestaurantMenuView | null>;
  getMenuItemView(itemId: string): Promise<MenuItemView | null>;
  getItemsSnapshot(itemIds: string[]): Promise<MenuItemView[]>;
}
