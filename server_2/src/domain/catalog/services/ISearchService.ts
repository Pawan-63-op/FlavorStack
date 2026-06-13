import { GeoPoint } from '../../identity/value-objects/GeoPoint.vo';
import { CuisineType } from '../enums/cuisine-type.enum';
import { DietaryTag } from '../enums/dietary-tag.enum';
import { CursorPage, CursorPaginationParams } from '../types/CursorPagination';
import { MenuItemSearchView, RestaurantSummaryView } from '../types/ReadModels';

export interface RestaurantSearchFilters {
  cuisineTypes?: CuisineType[];
  isOpenNow?: boolean;
}

export interface MenuItemSearchFilters {
  dietary?: DietaryTag[];
  isAvailable?: boolean;
  restaurantId?: string;
}

export interface ISearchService {
  searchRestaurants(
    query: string,
    filters?: RestaurantSearchFilters,
    params?: CursorPaginationParams
  ): Promise<CursorPage<RestaurantSummaryView>>;

  searchItems(
    query: string,
    filters?: MenuItemSearchFilters,
    params?: CursorPaginationParams
  ): Promise<CursorPage<MenuItemSearchView>>;

  nearby(
    point: GeoPoint,
    radiusMeters: number,
    filters?: RestaurantSearchFilters,
    params?: CursorPaginationParams
  ): Promise<CursorPage<RestaurantSummaryView>>;
}
