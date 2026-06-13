// MongoCatalogReadRepository — projection-driven reads for customer-facing queries
// (Catalog Phase 9). Reads ONLY the denormalized read-model collections (never the
// write aggregates) and derives the time-dependent `isOpen` / effective item
// availability at query time.
//
// Visibility policy: the public-facing finders surface only PUBLIC + ACTIVE +
// live (deletedAt: null) restaurants, so hidden/draft/paused/closed restaurants
// disappear from browse/detail/search. `getItemsSnapshot` is the exception — it
// is the Cart/Order snapshot read and returns raw item price/availability by id
// regardless of restaurant open-state.
import {
  ICatalogReadRepository,
  ListRestaurantsFilter,
} from '../../domain/catalog/repositories/ICatalogReadRepository';
import { CursorPage, CursorPaginationParams } from '../../domain/catalog/types/CursorPagination';
import {
  MenuItemView,
  RestaurantMenuView,
  RestaurantMenuCategoryView,
  RestaurantSummaryView,
} from '../../domain/catalog/types/ReadModels';
import { CuisineType } from '../../domain/catalog/enums/cuisine-type.enum';
import { DietaryTag } from '../../domain/catalog/enums/dietary-tag.enum';
import { RestaurantStatus } from '../../domain/catalog/enums/restaurant-status.enum';
import { RESTAURANT_STATUS } from '../../domain/catalog/enums/restaurant-status.enum';
import { CATALOG_VISIBILITY } from '../../domain/catalog/enums/catalog-visibility.enum';
import { RestaurantSummaryModel, RestaurantSummaryDocument } from '../database/models/RestaurantSummaryModel';
import {
  RestaurantMenuViewModel,
  RestaurantMenuViewDocument,
  MenuViewItemDocument,
} from '../database/models/RestaurantMenuViewModel';
import { MenuItemSearchModel, MenuItemSearchDocument } from '../database/models/MenuItemSearchModel';
import { deriveIsOpen } from '../database/projections/openState';

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

function normalizeLimit(limit?: number): number {
  if (!limit || limit < 1) return DEFAULT_PAGE_LIMIT;
  return Math.min(limit, MAX_PAGE_LIMIT);
}

const PUBLIC_RESTAURANT_FILTER = {
  visibility: CATALOG_VISIBILITY.PUBLIC,
  status: RESTAURANT_STATUS.ACTIVE,
  deletedAt: null,
};

export class MongoCatalogReadRepository implements ICatalogReadRepository {
  private toSummaryView(doc: RestaurantSummaryDocument, now: Date): RestaurantSummaryView {
    return {
      id: doc._id,
      name: doc.name,
      slug: doc.slug,
      cuisineTypes: doc.cuisineTypes as CuisineType[],
      status: doc.status as RestaurantStatus,
      isOpen: deriveIsOpen(
        { status: doc.status, openingHours: doc.openingHours, tzOffsetMinutes: doc.tzOffsetMinutes },
        now
      ),
      location: { lat: doc.location.coordinates[1], lng: doc.location.coordinates[0] },
      imageUrl: doc.imageUrl ?? undefined,
    };
  }

  async getRestaurantSummary(restaurantId: string): Promise<RestaurantSummaryView | null> {
    const doc = await RestaurantSummaryModel.findOne({
      _id: restaurantId,
      ...PUBLIC_RESTAURANT_FILTER,
    }).lean<RestaurantSummaryDocument>();
    return doc ? this.toSummaryView(doc, new Date()) : null;
  }

  async getRestaurantSummaryBySlug(slug: string): Promise<RestaurantSummaryView | null> {
    const doc = await RestaurantSummaryModel.findOne({
      slug,
      ...PUBLIC_RESTAURANT_FILTER,
    }).lean<RestaurantSummaryDocument>();
    return doc ? this.toSummaryView(doc, new Date()) : null;
  }

  async listRestaurantSummaries(
    filter: ListRestaurantsFilter,
    params: CursorPaginationParams
  ): Promise<CursorPage<RestaurantSummaryView>> {
    const limit = normalizeLimit(params.limit);
    const query: Record<string, unknown> = { ...PUBLIC_RESTAURANT_FILTER };
    if (filter.cuisineTypes && filter.cuisineTypes.length > 0) {
      query.cuisineTypes = { $in: filter.cuisineTypes };
    }
    if (params.cursor) {
      query._id = { $gt: params.cursor };
    }

    const now = new Date();
    // `isOpen` is a derived filter, so it cannot be pushed into the query; we
    // over-fetch and filter in memory, walking pages until the requested page is
    // filled or the collection is exhausted.
    const wantsOpenFilter = filter.isOpen !== undefined;
    const items: RestaurantSummaryView[] = [];
    let cursor = params.cursor;
    let exhausted = false;

    while (items.length <= limit && !exhausted) {
      const pageQuery: Record<string, unknown> = { ...query };
      if (cursor) pageQuery._id = { $gt: cursor };

      const docs = await RestaurantSummaryModel.find(pageQuery)
        .sort({ _id: 1 })
        .limit(limit + 1)
        .lean<RestaurantSummaryDocument[]>();

      if (docs.length === 0) {
        exhausted = true;
        break;
      }

      for (const doc of docs) {
        cursor = doc._id;
        const view = this.toSummaryView(doc, now);
        if (wantsOpenFilter && view.isOpen !== filter.isOpen) continue;
        items.push(view);
        if (items.length > limit) break;
      }

      if (docs.length <= limit) exhausted = true;
      if (!wantsOpenFilter) break;
    }

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1].id : undefined,
    };
  }

  async getRestaurantMenu(restaurantId: string): Promise<RestaurantMenuView | null> {
    const doc = await RestaurantMenuViewModel.findOne({
      _id: restaurantId,
      ...PUBLIC_RESTAURANT_FILTER,
    }).lean<RestaurantMenuViewDocument>();
    if (!doc) return null;

    const now = new Date();
    const restaurantOpen = deriveIsOpen(
      { status: doc.status, openingHours: doc.openingHours, tzOffsetMinutes: doc.tzOffsetMinutes },
      now
    );

    const categories: RestaurantMenuCategoryView[] = doc.categories.map((cat) => ({
      id: cat.id,
      label: cat.label,
      sortOrder: cat.sortOrder,
      items: cat.items.map((item) => this.toMenuItemView(item, restaurantOpen)),
    }));

    return {
      restaurant: {
        id: doc._id,
        name: doc.name,
        slug: doc.slug,
        cuisineTypes: doc.cuisineTypes as CuisineType[],
        status: doc.status as RestaurantStatus,
        isOpen: restaurantOpen,
        location: { lat: doc.location.coordinates[1], lng: doc.location.coordinates[0] },
        imageUrl: doc.imageUrl ?? undefined,
      },
      categories,
    };
  }

  // Effective availability ANDs the item's raw toggle with the restaurant open-state.
  private toMenuItemView(item: MenuViewItemDocument, restaurantOpen: boolean): MenuItemView {
    return {
      id: item.id,
      restaurantId: item.restaurantId,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description ?? undefined,
      imageUrl: item.imageUrl ?? undefined,
      basePriceAmount: item.basePriceAmount,
      currency: item.currency,
      tags: item.tags,
      dietary: item.dietary as DietaryTag[],
      isAvailable: item.isAvailable && restaurantOpen,
    };
  }

  async getMenuItemView(itemId: string): Promise<MenuItemView | null> {
    const doc = await MenuItemSearchModel.findOne({
      _id: itemId,
      restaurantVisibility: CATALOG_VISIBILITY.PUBLIC,
      restaurantStatus: RESTAURANT_STATUS.ACTIVE,
      deletedAt: null,
    }).lean<MenuItemSearchDocument>();
    if (!doc) return null;

    // Derive effective availability against the restaurant's live open-state.
    const summary = await RestaurantSummaryModel.findOne({ _id: doc.restaurantId }).lean<RestaurantSummaryDocument>();
    const restaurantOpen = summary
      ? deriveIsOpen(
          { status: summary.status, openingHours: summary.openingHours, tzOffsetMinutes: summary.tzOffsetMinutes },
          new Date()
        )
      : false;

    return this.searchDocToView(doc, doc.isAvailable && restaurantOpen);
  }

  async getItemsSnapshot(itemIds: string[]): Promise<MenuItemView[]> {
    if (itemIds.length === 0) return [];
    const docs = await MenuItemSearchModel.find({
      _id: { $in: itemIds },
      deletedAt: null,
    }).lean<MenuItemSearchDocument[]>();
    // Snapshot is the Cart/Order contract: raw item price + availability, no
    // restaurant open-state override.
    return docs.map((doc) => this.searchDocToView(doc, doc.isAvailable));
  }

  private searchDocToView(doc: MenuItemSearchDocument, isAvailable: boolean): MenuItemView {
    return {
      id: doc._id,
      restaurantId: doc.restaurantId,
      categoryId: doc.categoryId,
      name: doc.name,
      description: doc.description ?? undefined,
      imageUrl: doc.imageUrl ?? undefined,
      basePriceAmount: doc.basePriceAmount,
      currency: doc.currency,
      tags: doc.tags,
      dietary: doc.dietary as DietaryTag[],
      isAvailable,
    };
  }
}
