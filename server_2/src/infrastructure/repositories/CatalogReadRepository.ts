import {
  ICatalogReadRepository,
  ListRestaurantsFilter,
} from '../../domain/catalog/repositories/ICatalogReadRepository';
import { CursorPage, CursorPaginationParams } from '../../domain/catalog/types/CursorPagination';
import {
  MenuItemDetailView,
  MenuItemVariantGroupView,
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
import { ICatalogQueryRepository } from '../../domain/catalog/repositories/ICatalogQueryRepository';
import { CatalogQueryMenuItem, CatalogQueryVariantGroup } from '../../domain/catalog/types/QueryModels';
import { RestaurantSummaryModel, RestaurantSummaryDocument } from '../database/models/RestaurantSummaryModel';
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
  /**
   * `getRestaurantMenu` reads the catalog source of truth through the query repository;
   * every other read here still comes from the `restaurant_summary` / `menu_item_search`
   * projections, which remain the discovery/search read models.
   */
  constructor(private readonly queryRepo: ICatalogQueryRepository) {}

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
    if (filter.restaurantIds && filter.restaurantIds.length === 0) return { items: [] };

    const query: Record<string, unknown> = { ...PUBLIC_RESTAURANT_FILTER };
    if (filter.cuisineTypes && filter.cuisineTypes.length > 0) {
      query.cuisineTypes = { $in: filter.cuisineTypes };
    }
    // The id restriction and the cursor share the `_id` operator object, so they are
    // merged rather than assigned — assigning would silently drop one of them.
    const idFilter: Record<string, unknown> = filter.restaurantIds
      ? { $in: filter.restaurantIds }
      : {};

    const now = new Date();
    const wantsOpenFilter = filter.isOpen !== undefined;
    const items: RestaurantSummaryView[] = [];
    let cursor = params.cursor;
    let exhausted = false;

    while (items.length <= limit && !exhausted) {
      const pageQuery: Record<string, unknown> = { ...query };
      const idQuery = { ...idFilter, ...(cursor ? { $gt: cursor } : {}) };
      if (Object.keys(idQuery).length > 0) pageQuery._id = idQuery;

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

  /**
   * Assembled from `restaurants` + `menu_items` rather than a projection. The shape
   * reproduces what `restaurant_menu_view` used to carry, so the response body is
   * unchanged: inactive categories are dropped, the rest are ordered by `sortOrder`,
   * items are bucketed into their category in `_id` order (the order the write-side
   * repository paginates in), and an item whose `categoryId` names an inactive or
   * absent category is dropped entirely.
   */
  async getRestaurantMenu(restaurantId: string): Promise<RestaurantMenuView | null> {
    const restaurant = await this.queryRepo.findPublicRestaurantById(restaurantId);
    if (!restaurant) return null;

    const now = new Date();
    const restaurantOpen = deriveIsOpen(
      {
        status: restaurant.status,
        openingHours: restaurant.openingHours,
        // The projector hardcoded 0 here and never sourced a real offset; kept as-is so
        // open/closed evaluation is byte-identical to the projected view.
        tzOffsetMinutes: 0,
      },
      now
    );

    const items = await this.queryRepo.findMenuItemsByRestaurant(restaurantId);
    const itemsByCategory = new Map<string, CatalogQueryMenuItem[]>();
    for (const item of items) {
      const list = itemsByCategory.get(item.categoryId) ?? [];
      list.push(item);
      itemsByCategory.set(item.categoryId, list);
    }

    const categories: RestaurantMenuCategoryView[] = restaurant.categories
      .filter((category) => category.isActive)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((category) => ({
        id: category.id,
        label: category.label,
        sortOrder: category.sortOrder,
        items: (itemsByCategory.get(category.id) ?? []).map((item) =>
          this.toMenuItemView(item, restaurantOpen)
        ),
      }));

    return {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        cuisineTypes: restaurant.cuisineTypes as CuisineType[],
        status: restaurant.status as RestaurantStatus,
        isOpen: restaurantOpen,
        location: restaurant.location,
        imageUrl: restaurant.imageUrl ?? undefined,
      },
      categories,
    };
  }

  private toMenuItemView(item: CatalogQueryMenuItem, restaurantOpen: boolean): MenuItemView {
    return {
      id: item.id,
      restaurantId: item.restaurantId,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description ?? undefined,
      imageUrl: item.imageUrl ?? undefined,
      basePriceAmount: item.basePrice.amount,
      currency: item.basePrice.currency,
      tags: item.tags,
      dietary: item.dietary as DietaryTag[],
      isAvailable: item.isAvailable && restaurantOpen,
      hasVariants: item.variantGroups.length > 0,
    };
  }

  /**
   * `CatalogQueryVariantGroup` carries `priceDelta` as a `{amount, currency}` pair;
   * the read model flattens it the way it flattens `basePrice`, so a client sees one
   * currency convention across the whole item.
   */
  private toVariantGroupViews(groups: CatalogQueryVariantGroup[]): MenuItemVariantGroupView[] {
    return groups.map((group) => ({
      id: group.id,
      label: group.label,
      selectionType: group.selectionType,
      required: group.required,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      options: group.options.map((option) => ({
        id: option.id,
        label: option.label,
        priceDeltaAmount: option.priceDelta.amount,
        currency: option.priceDelta.currency,
        isDefault: option.isDefault,
        isAvailable: option.isAvailable,
      })),
    }));
  }

  /**
   * The publish gate and open-state derivation stay on the `menu_item_search`
   * projection (unchanged), but variant groups are not projected — they are read from
   * the catalog source of truth, the same place `getRestaurantMenu` reads items from.
   * The customer picker needs option ids and price deltas that are correct *now*, and
   * a stale projected option would be rejected by `CheckoutContextAssembler.resolveOptions`
   * at checkout anyway.
   */
  async getMenuItemView(itemId: string): Promise<MenuItemDetailView | null> {
    const doc = await MenuItemSearchModel.findOne({
      _id: itemId,
      restaurantVisibility: CATALOG_VISIBILITY.PUBLIC,
      restaurantStatus: RESTAURANT_STATUS.ACTIVE,
      deletedAt: null,
    }).lean<MenuItemSearchDocument>();
    if (!doc) return null;

    const summary = await RestaurantSummaryModel.findOne({ _id: doc.restaurantId }).lean<RestaurantSummaryDocument>();
    const restaurantOpen = summary
      ? deriveIsOpen(
          { status: summary.status, openingHours: summary.openingHours, tzOffsetMinutes: summary.tzOffsetMinutes },
          new Date()
        )
      : false;

    const [sourceItem] = await this.queryRepo.findMenuItemsByIds([itemId]);
    return {
      ...this.searchDocToView(doc, doc.isAvailable && restaurantOpen),
      hasVariants: (sourceItem?.variantGroups.length ?? 0) > 0,
      variantGroups: this.toVariantGroupViews(sourceItem?.variantGroups ?? []),
    };
  }

  async getItemsSnapshot(itemIds: string[]): Promise<MenuItemView[]> {
    if (itemIds.length === 0) return [];
    const docs = await MenuItemSearchModel.find({
      _id: { $in: itemIds },
      deletedAt: null,
    }).lean<MenuItemSearchDocument[]>();
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
      hasVariants: doc.hasVariants ?? false,
    };
  }
}
