import { MenuItem } from '../entities/MenuItem';
import { CursorPage, CursorPaginationParams } from '../types/CursorPagination';

export interface IMenuItemRepository {
  save(menuItem: MenuItem): Promise<void>;
  update(menuItem: MenuItem): Promise<void>;
  softDelete(id: string): Promise<void>;
  findById(id: string): Promise<MenuItem | null>;
  findByRestaurant(restaurantId: string, params?: CursorPaginationParams): Promise<CursorPage<MenuItem>>;
  findByCategory(categoryId: string, params?: CursorPaginationParams): Promise<CursorPage<MenuItem>>;
}
