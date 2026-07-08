import { ICommerceCatalogReadRepository } from '../../domain/commerce/repositories/ICommerceCatalogReadRepository';
import {
  CommerceCatalogMenuItemView,
  CommerceCatalogRestaurantView,
} from '../../domain/commerce/types/CommerceCatalogView';
import { CommerceCatalogViewModel, CommerceCatalogViewDocument } from '../database/models/CommerceCatalogViewModel';
import { CommerceCatalogProjectionCheckpointModel } from '../database/models/CommerceCatalogProjectionCheckpointModel';

const DUPLICATE_KEY_ERROR_CODE = 11000;

function toView(doc: CommerceCatalogViewDocument): CommerceCatalogRestaurantView {
  return {
    restaurantId: doc._id,
    name: doc.name,
    slug: doc.slug,
    status: doc.status,
    visibility: doc.visibility,
    openingHours: doc.openingHours,
    tzOffsetMinutes: doc.tzOffsetMinutes,
    deliveryZones: doc.deliveryZones,
    items: doc.items,
    updatedAt: doc.updatedAt,
  };
}

export class CommerceCatalogReadRepository implements ICommerceCatalogReadRepository {
  async findRestaurantView(restaurantId: string): Promise<CommerceCatalogRestaurantView | null> {
    const doc = await CommerceCatalogViewModel.findById(restaurantId).lean<CommerceCatalogViewDocument>();
    return doc ? toView(doc) : null;
  }

  async findMenuItemViews(menuItemIds: string[]): Promise<CommerceCatalogMenuItemView[]> {
    if (menuItemIds.length === 0) return [];
    const docs = await CommerceCatalogViewModel.find({ 'items.menuItemId': { $in: menuItemIds } })
      .lean<CommerceCatalogViewDocument[]>();
    const wanted = new Set(menuItemIds);
    const items: CommerceCatalogMenuItemView[] = [];
    for (const doc of docs) {
      for (const item of doc.items) {
        if (wanted.has(item.menuItemId)) items.push(item);
      }
    }
    return items;
  }

  async upsertRestaurantView(view: CommerceCatalogRestaurantView): Promise<void> {
    const doc: CommerceCatalogViewDocument = {
      _id: view.restaurantId,
      name: view.name,
      slug: view.slug,
      status: view.status,
      visibility: view.visibility,
      openingHours: view.openingHours,
      tzOffsetMinutes: view.tzOffsetMinutes,
      deliveryZones: view.deliveryZones,
      items: view.items,
      updatedAt: view.updatedAt,
    };
    await CommerceCatalogViewModel.replaceOne({ _id: view.restaurantId }, doc, { upsert: true });
  }

  async removeRestaurantView(restaurantId: string): Promise<void> {
    await CommerceCatalogViewModel.deleteOne({ _id: restaurantId });
  }

  async markEventProcessed(eventId: string, eventName: string, restaurantId: string): Promise<boolean> {
    try {
      await CommerceCatalogProjectionCheckpointModel.create({
        _id: eventId,
        eventName,
        restaurantId,
        processedAt: new Date(),
      });
      return true;
    } catch (err) {
      if (this.isDuplicateKeyError(err)) return false;
      throw err;
    }
  }

  private isDuplicateKeyError(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: number }).code === DUPLICATE_KEY_ERROR_CODE;
  }
}
