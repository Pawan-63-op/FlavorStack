import { ICatalogProjectionWriter } from '../../../domain/catalog/repositories/ICatalogProjectionWriter';
import { Restaurant } from '../../../domain/catalog/entities/Restaurant';
import { MenuItem } from '../../../domain/catalog/entities/MenuItem';
import { RestaurantSummaryModel, RestaurantSummaryDocument } from '../models/RestaurantSummaryModel';
import { MenuItemSearchModel, MenuItemSearchDocument } from '../models/MenuItemSearchModel';
import { OpeningHoursDocument } from '../models/RestaurantModel';

function openingHoursToDoc(restaurant: Restaurant): OpeningHoursDocument | null {
  const hours = restaurant.openingHours;
  if (!hours) return null;
  return { schedule: hours.schedule, holidays: [...hours.holidays] };
}

/** The flat item fields shared by every projection this writer maintains. */
interface ProjectedMenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePriceAmount: number;
  currency: string;
  tags: string[];
  dietary: string[];
  isAvailable: boolean;
}

function menuItemToViewDoc(item: MenuItem): ProjectedMenuItem {
  return {
    id: item.id.toString(),
    restaurantId: item.restaurantId,
    categoryId: item.categoryId,
    name: item.name,
    description: item.description ?? null,
    imageUrl: item.imageUrl ?? null,
    basePriceAmount: item.basePrice.amount,
    currency: item.basePrice.currency,
    tags: item.tags,
    dietary: item.dietary,
    isAvailable: item.availability.isAvailable,
  };
}

export class CatalogProjectionWriter implements ICatalogProjectionWriter {
  async rebuildRestaurant(restaurant: Restaurant, items: MenuItem[]): Promise<void> {
    const restaurantId = restaurant.id.toString();
    const status = restaurant.status.value;
    const visibility = restaurant.visibility.value;
    const location = restaurant.location.toGeoJson();
    const openingHours = openingHoursToDoc(restaurant);

    const summary: RestaurantSummaryDocument = {
      _id: restaurantId,
      name: restaurant.name,
      slug: restaurant.slug,
      cuisineTypes: restaurant.cuisineTypes.map((c) => c.value),
      status,
      visibility,
      location,
      imageUrl: restaurant.imageUrl ?? null,
      openingHours,
      tzOffsetMinutes: 0,
      deletedAt: null,
    };
    await RestaurantSummaryModel.replaceOne({ _id: restaurantId }, summary, { upsert: true });

    const searchDocs: MenuItemSearchDocument[] = items.map((item) => {
      const view = menuItemToViewDoc(item);
      return {
        _id: view.id,
        restaurantId: view.restaurantId,
        categoryId: view.categoryId,
        name: view.name,
        description: view.description,
        imageUrl: view.imageUrl,
        basePriceAmount: view.basePriceAmount,
        currency: view.currency,
        tags: view.tags,
        dietary: view.dietary,
        isAvailable: view.isAvailable,
        restaurantName: restaurant.name,
        restaurantSlug: restaurant.slug,
        restaurantStatus: status,
        restaurantVisibility: visibility,
        deletedAt: null,
      };
    });
    if (searchDocs.length > 0) {
      await MenuItemSearchModel.bulkWrite(
        searchDocs.map((doc) => ({
          replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
        })),
        { ordered: false }
      );
    }
    const keepIds = searchDocs.map((d) => d._id);
    await MenuItemSearchModel.deleteMany({ restaurantId, _id: { $nin: keepIds } });
  }

  async removeRestaurant(restaurantId: string): Promise<void> {
    const deletedAt = new Date();
    await RestaurantSummaryModel.updateOne({ _id: restaurantId }, { $set: { deletedAt } });
    await MenuItemSearchModel.deleteMany({ restaurantId });
  }
}
