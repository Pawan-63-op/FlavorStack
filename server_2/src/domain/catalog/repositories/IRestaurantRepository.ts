import { Restaurant } from '../entities/Restaurant';
import { CursorPage, CursorPaginationParams } from '../types/CursorPagination';

export interface IRestaurantRepository {
  save(restaurant: Restaurant): Promise<void>;
  update(restaurant: Restaurant): Promise<void>;
  softDelete(id: string): Promise<void>;
  findById(id: string): Promise<Restaurant | null>;
  findBySlug(slug: string): Promise<Restaurant | null>;
  findByOwner(ownerId: string, params?: CursorPaginationParams): Promise<CursorPage<Restaurant>>;
  findAll(params: CursorPaginationParams): Promise<CursorPage<Restaurant>>;
  /** Total count of non-deleted restaurants (platform-wide). Used by analytics. */
  count(): Promise<number>;
}
