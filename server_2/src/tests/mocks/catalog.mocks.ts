import { Restaurant } from '../../domain/catalog/entities/Restaurant';
import { MenuItem } from '../../domain/catalog/entities/MenuItem';
import { IRestaurantRepository } from '../../domain/catalog/repositories/IRestaurantRepository';
import { IMenuItemRepository } from '../../domain/catalog/repositories/IMenuItemRepository';
import { CursorPage, CursorPaginationParams } from '../../domain/catalog/types/CursorPagination';

export class InMemoryRestaurantRepository implements IRestaurantRepository {
  private byId = new Map<string, Restaurant>();

  async save(restaurant: Restaurant): Promise<void> {
    this.byId.set(restaurant.id.toString(), restaurant);
  }

  async update(restaurant: Restaurant): Promise<void> {
    this.byId.set(restaurant.id.toString(), restaurant);
  }

  async softDelete(id: string): Promise<void> {
    this.byId.delete(id);
  }

  async findById(id: string): Promise<Restaurant | null> {
    return this.byId.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<Restaurant | null> {
    for (const restaurant of this.byId.values()) {
      if (restaurant.slug === slug) return restaurant;
    }
    return null;
  }

  async findByOwner(ownerId: string, _params?: CursorPaginationParams): Promise<CursorPage<Restaurant>> {
    return { items: [...this.byId.values()].filter((r) => r.ownerId === ownerId) };
  }

  async findAll(_params: CursorPaginationParams): Promise<CursorPage<Restaurant>> {
    return { items: [...this.byId.values()] };
  }

  async count(): Promise<number> {
    return this.byId.size;
  }
}

export class InMemoryMenuItemRepository implements IMenuItemRepository {
  private byId = new Map<string, MenuItem>();

  async save(menuItem: MenuItem): Promise<void> {
    this.byId.set(menuItem.id.toString(), menuItem);
  }

  async update(menuItem: MenuItem): Promise<void> {
    this.byId.set(menuItem.id.toString(), menuItem);
  }

  async softDelete(id: string): Promise<void> {
    this.byId.delete(id);
  }

  async findById(id: string): Promise<MenuItem | null> {
    return this.byId.get(id) ?? null;
  }

  async findByRestaurant(restaurantId: string, _params?: CursorPaginationParams): Promise<CursorPage<MenuItem>> {
    return { items: [...this.byId.values()].filter((m) => m.restaurantId === restaurantId) };
  }

  async findByCategory(categoryId: string, _params?: CursorPaginationParams): Promise<CursorPage<MenuItem>> {
    return { items: [...this.byId.values()].filter((m) => m.categoryId === categoryId) };
  }
}
