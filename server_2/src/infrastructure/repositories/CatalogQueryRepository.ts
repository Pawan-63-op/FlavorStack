import { ICatalogQueryRepository } from '../../domain/catalog/repositories/ICatalogQueryRepository';
import {
  CatalogQueryMenuItem,
  CatalogQueryRestaurant,
} from '../../domain/catalog/types/QueryModels';
import { RESTAURANT_STATUS, RestaurantStatus } from '../../domain/catalog/enums/restaurant-status.enum';
import { CATALOG_VISIBILITY, CatalogVisibility } from '../../domain/catalog/enums/catalog-visibility.enum';
import { RestaurantModel, RestaurantDocument } from '../database/models/RestaurantModel';
import { MenuItemModel, MenuItemDocument } from '../database/models/MenuItemModel';

/** The published-restaurant filter, identical to the one `MongoCatalogReadRepository`
 *  applies to `restaurant_summary` — kept in sync so source-of-truth reads gate on
 *  exactly what the search projection gates on. */
const PUBLIC_RESTAURANT_FILTER = {
  visibility: CATALOG_VISIBILITY.PUBLIC,
  status: RESTAURANT_STATUS.ACTIVE,
  deletedAt: null,
};

export class MongoCatalogQueryRepository implements ICatalogQueryRepository {
  async findRestaurantById(restaurantId: string): Promise<CatalogQueryRestaurant | null> {
    const doc = await RestaurantModel.findOne({
      _id: restaurantId,
      deletedAt: null,
    }).lean<RestaurantDocument>();
    return doc ? this.toRestaurant(doc) : null;
  }

  async findPublicRestaurantById(restaurantId: string): Promise<CatalogQueryRestaurant | null> {
    const doc = await RestaurantModel.findOne({
      _id: restaurantId,
      ...PUBLIC_RESTAURANT_FILTER,
    }).lean<RestaurantDocument>();
    return doc ? this.toRestaurant(doc) : null;
  }

  async findPublicRestaurantsByIds(restaurantIds: string[]): Promise<CatalogQueryRestaurant[]> {
    if (restaurantIds.length === 0) return [];

    const docs = await RestaurantModel.find({
      _id: { $in: restaurantIds },
      ...PUBLIC_RESTAURANT_FILTER,
    }).lean<RestaurantDocument[]>();
    return docs.map((doc) => this.toRestaurant(doc));
  }

  async findMenuItemsByIds(menuItemIds: string[]): Promise<CatalogQueryMenuItem[]> {
    if (menuItemIds.length === 0) return [];

    const docs = await MenuItemModel.find({
      _id: { $in: menuItemIds },
      deletedAt: null,
    }).lean<MenuItemDocument[]>();
    return docs.map((doc) => this.toMenuItem(doc));
  }

  async findMenuItemsByRestaurant(restaurantId: string): Promise<CatalogQueryMenuItem[]> {
    // `_id` ascending is the order the write-side repository paginates in, and therefore
    // the order items already appear in for every consumer of this data today.
    const docs = await MenuItemModel.find({ restaurantId, deletedAt: null })
      .sort({ _id: 1 })
      .lean<MenuItemDocument[]>();
    return docs.map((doc) => this.toMenuItem(doc));
  }

  private toRestaurant(doc: RestaurantDocument): CatalogQueryRestaurant {
    return {
      id: doc._id,
      name: doc.name,
      slug: doc.slug,
      description: doc.description ?? null,
      cuisineTypes: doc.cuisineTypes ?? [],
      status: doc.status as RestaurantStatus,
      visibility: doc.visibility as CatalogVisibility,
      imageUrl: doc.imageUrl ?? null,
      location: { lat: doc.location.coordinates[1], lng: doc.location.coordinates[0] },
      openingHours: doc.openingHours
        ? {
            schedule: doc.openingHours.schedule,
            holidays: [...(doc.openingHours.holidays ?? [])],
          }
        : null,
      categories: (doc.categories ?? []).map((category) => ({
        id: category.id,
        label: category.label,
        sortOrder: category.sortOrder,
        isActive: category.isActive,
      })),
      deliveryZones: (doc.deliveryZones ?? []).map((zone) => ({
        id: zone.id,
        feeTiers: (zone.feeMatrix?.tiers ?? []).map((tier) => ({
          maxDistanceMeters: tier.maxDistanceMeters,
          fee: { amount: tier.fee.amount, currency: tier.fee.currency },
        })),
        freeAboveSubtotal: zone.feeMatrix?.freeAboveSubtotal
          ? {
              amount: zone.feeMatrix.freeAboveSubtotal.amount,
              currency: zone.feeMatrix.freeAboveSubtotal.currency,
            }
          : null,
        minOrder: { amount: zone.minOrder.amount, currency: zone.minOrder.currency },
      })),
    };
  }

  private toMenuItem(doc: MenuItemDocument): CatalogQueryMenuItem {
    return {
      id: doc._id,
      restaurantId: doc.restaurantId,
      categoryId: doc.categoryId,
      name: doc.name,
      description: doc.description ?? null,
      imageUrl: doc.imageUrl ?? null,
      basePrice: { amount: doc.basePrice.amount, currency: doc.basePrice.currency },
      tags: doc.tags ?? [],
      dietary: doc.dietary ?? [],
      isAvailable: doc.availability.isAvailable,
      outOfStockReason: doc.availability.outOfStockReason ?? null,
      variantGroups: (doc.variantGroups ?? []).map((group) => ({
        id: group.id,
        label: group.label,
        selectionType: group.selectionType,
        required: group.required,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        options: (group.options ?? []).map((option) => ({
          id: option.id,
          label: option.label,
          priceDelta: { amount: option.priceDelta.amount, currency: option.priceDelta.currency },
          isDefault: option.isDefault,
          isAvailable: option.isAvailable,
        })),
      })),
    };
  }
}
