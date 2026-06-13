// CatalogProjectionWriter — maps catalog aggregates to read-model documents and
// upserts the three projection collections (Catalog Phase 9).
//
// Called by the CatalogProjector AFTER the write transaction commits, so it uses
// plain (session-less) Mongo writes. `rebuildRestaurant` is a wholesale rebuild:
// summary + menu-view are replaced (upsert by _id) and the restaurant's search
// docs are swapped for the current item set, so removed items vanish.
import { ICatalogProjectionWriter } from '../../../domain/catalog/repositories/ICatalogProjectionWriter';
import { Restaurant } from '../../../domain/catalog/entities/Restaurant';
import { MenuItem } from '../../../domain/catalog/entities/MenuItem';
import { Category } from '../../../domain/catalog/entities/Category';
import { RestaurantSummaryModel, RestaurantSummaryDocument } from '../models/RestaurantSummaryModel';
import {
  RestaurantMenuViewModel,
  RestaurantMenuViewDocument,
  MenuViewItemDocument,
  MenuViewCategoryDocument,
} from '../models/RestaurantMenuViewModel';
import { MenuItemSearchModel, MenuItemSearchDocument } from '../models/MenuItemSearchModel';
import { OpeningHoursDocument } from '../models/RestaurantModel';

function openingHoursToDoc(restaurant: Restaurant): OpeningHoursDocument | null {
  const hours = restaurant.openingHours;
  if (!hours) return null;
  return { schedule: hours.schedule, holidays: [...hours.holidays] };
}

function menuItemToViewDoc(item: MenuItem): MenuViewItemDocument {
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

    // ── restaurant_summary ───────────────────────────────────────
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

    // ── restaurant_menu_view (active categories, items grouped) ──
    const activeCategories = restaurant.categories.filter((c: Category) => c.isActive);
    const itemsByCategory = new Map<string, MenuViewItemDocument[]>();
    for (const item of items) {
      const list = itemsByCategory.get(item.categoryId) ?? [];
      list.push(menuItemToViewDoc(item));
      itemsByCategory.set(item.categoryId, list);
    }
    const categories: MenuViewCategoryDocument[] = activeCategories
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({
        id: c.id.toString(),
        label: c.label,
        sortOrder: c.sortOrder,
        items: itemsByCategory.get(c.id.toString()) ?? [],
      }));

    const menuView: RestaurantMenuViewDocument = {
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
      categories,
      deletedAt: null,
    };
    await RestaurantMenuViewModel.replaceOne({ _id: restaurantId }, menuView, { upsert: true });

    // ── menu_item_search (idempotent upsert + prune) ─────────────
    // Outbox delivery is at-least-once, so a rebuild can run more than once for
    // the same event. Upserting each current doc (instead of delete-then-insert)
    // makes replay a no-op rather than an E11000 duplicate-key error, then we
    // prune any docs for items that no longer belong to this restaurant.
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
    await RestaurantMenuViewModel.updateOne({ _id: restaurantId }, { $set: { deletedAt } });
    await MenuItemSearchModel.deleteMany({ restaurantId });
  }
}
