import { IRestaurantDirectory } from '../../application/fulfillment/ports/IRestaurantDirectory';
import { IRestaurantRepository } from '../../domain/catalog/repositories/IRestaurantRepository';

export class CatalogRestaurantDirectory implements IRestaurantDirectory {
  constructor(private readonly restaurantRepo: IRestaurantRepository) {}

  async getOwnerId(restaurantId: string): Promise<string | null> {
    const restaurant = await this.restaurantRepo.findById(restaurantId);
    return restaurant ? restaurant.ownerId : null;
  }

  async listRestaurantIdsByOwner(ownerId: string): Promise<string[]> {
    const ids: string[] = [];
    let cursor: string | undefined = undefined;
    do {
      const page = await this.restaurantRepo.findByOwner(ownerId, { cursor });
      for (const restaurant of page.items) ids.push(restaurant.id.toString());
      cursor = page.nextCursor;
    } while (cursor);
    return ids;
  }

  async getRestaurantNames(restaurantIds: string[]): Promise<Record<string, string>> {
    if (restaurantIds.length === 0) return {};
    const restaurants = await Promise.all(restaurantIds.map((id) => this.restaurantRepo.findById(id)));
    const names: Record<string, string> = {};
    for (const restaurant of restaurants) {
      if (restaurant) names[restaurant.id.toString()] = restaurant.name;
    }
    return names;
  }

  async countAll(): Promise<number> {
    return this.restaurantRepo.count();
  }
}
