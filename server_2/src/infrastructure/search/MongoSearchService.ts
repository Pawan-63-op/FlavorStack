// MongoSearchService — native MongoDB search/discovery behind ISearchService
// (Catalog Phase 10). NO Elasticsearch: relevance comes from Mongo `$text`
// scores and proximity from the `2dsphere` index via `$geoNear`.
//
// Searches read ONLY the denormalized projections (`restaurant_summary`,
// `menu_item_search`) — never the write aggregates. Visibility/availability
// policy mirrors the read repository: only PUBLIC + ACTIVE + live restaurants
// (and their items) ever surface. `isOpen` is time-dependent so it is DERIVED at
// query time and applied as an in-memory filter (it can't be pushed into Mongo).
//
// Pagination is cursor-based. For text search the cursor encodes the composite
// `(textScore, _id)` ordering key; for `nearby` it encodes `(distanceMeters, _id)`.
// Because the derived `isOpenNow` filter can't live in the query, those paths
// walk forward batch-by-batch until the requested page is filled.
import { PipelineStage } from 'mongoose';
import {
  ISearchService,
  RestaurantSearchFilters,
  MenuItemSearchFilters,
} from '../../domain/catalog/services/ISearchService';
import { GeoPoint } from '../../domain/identity/value-objects/GeoPoint.vo';
import { CuisineType } from '../../domain/catalog/enums/cuisine-type.enum';
import { DietaryTag } from '../../domain/catalog/enums/dietary-tag.enum';
import { RestaurantStatus, RESTAURANT_STATUS } from '../../domain/catalog/enums/restaurant-status.enum';
import { CATALOG_VISIBILITY } from '../../domain/catalog/enums/catalog-visibility.enum';
import { CursorPage, CursorPaginationParams } from '../../domain/catalog/types/CursorPagination';
import {
  RestaurantSummaryView,
  MenuItemSearchView,
} from '../../domain/catalog/types/ReadModels';
import {
  RestaurantSummaryModel,
  RestaurantSummaryDocument,
} from '../database/models/RestaurantSummaryModel';
import {
  MenuItemSearchModel,
  MenuItemSearchDocument,
} from '../database/models/MenuItemSearchModel';
import { deriveIsOpen } from '../database/projections/openState';

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

const PUBLIC_RESTAURANT_FILTER = {
  visibility: CATALOG_VISIBILITY.PUBLIC,
  status: RESTAURANT_STATUS.ACTIVE,
  deletedAt: null,
};

function normalizeLimit(limit?: number): number {
  if (!limit || limit < 1) return DEFAULT_PAGE_LIMIT;
  return Math.min(limit, MAX_PAGE_LIMIT);
}

// Composite cursor for relevance-ordered text search: (score, id).
interface ScoreCursor {
  s: number;
  i: string;
}
// Composite cursor for proximity-ordered geo search: (distanceMeters, id).
interface DistanceCursor {
  d: number;
  i: string;
}

function encodeCursor(value: ScoreCursor | DistanceCursor): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeCursor<T>(cursor?: string): T | undefined {
  if (!cursor) return undefined;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as T;
  } catch {
    return undefined;
  }
}

export class MongoSearchService implements ISearchService {
  async searchRestaurants(
    query: string,
    filters: RestaurantSearchFilters = {},
    params: CursorPaginationParams = {}
  ): Promise<CursorPage<RestaurantSummaryView>> {
    const limit = normalizeLimit(params.limit);
    const baseMatch: Record<string, unknown> = {
      $text: { $search: query },
      ...PUBLIC_RESTAURANT_FILTER,
    };
    if (filters.cuisineTypes && filters.cuisineTypes.length > 0) {
      baseMatch.cuisineTypes = { $in: filters.cuisineTypes };
    }

    const now = new Date();
    const wantsOpenFilter = filters.isOpenNow !== undefined;
    const collected: Array<{ view: RestaurantSummaryView; cursor: ScoreCursor }> = [];
    let cursor = decodeCursor<ScoreCursor>(params.cursor);
    let exhausted = false;

    while (collected.length <= limit && !exhausted) {
      const pipeline: PipelineStage[] = [
        { $match: baseMatch },
        { $addFields: { _score: { $meta: 'textScore' } } },
      ];
      if (cursor) {
        pipeline.push({
          $match: {
            $or: [
              { _score: { $lt: cursor.s } },
              { _score: cursor.s, _id: { $gt: cursor.i } },
            ],
          },
        });
      }
      pipeline.push({ $sort: { _score: -1, _id: 1 } }, { $limit: limit + 1 });

      const docs = await RestaurantSummaryModel.aggregate<
        RestaurantSummaryDocument & { _score: number }
      >(pipeline);

      if (docs.length === 0) {
        exhausted = true;
        break;
      }

      for (const doc of docs) {
        cursor = { s: doc._score, i: doc._id };
        const view = this.toSummaryView(doc, now);
        if (wantsOpenFilter && view.isOpen !== filters.isOpenNow) continue;
        collected.push({ view, cursor });
        if (collected.length > limit) break;
      }

      if (docs.length <= limit) exhausted = true;
      if (!wantsOpenFilter) break;
    }

    return this.toPage(collected, limit);
  }

  async searchItems(
    query: string,
    filters: MenuItemSearchFilters = {},
    params: CursorPaginationParams = {}
  ): Promise<CursorPage<MenuItemSearchView>> {
    const limit = normalizeLimit(params.limit);
    const baseMatch: Record<string, unknown> = {
      $text: { $search: query },
      deletedAt: null,
      restaurantVisibility: CATALOG_VISIBILITY.PUBLIC,
      restaurantStatus: RESTAURANT_STATUS.ACTIVE,
    };
    // `$all`: an item must carry every requested dietary tag (e.g. VEG + HALAL).
    if (filters.dietary && filters.dietary.length > 0) {
      baseMatch.dietary = { $all: filters.dietary };
    }
    if (filters.isAvailable !== undefined) {
      baseMatch.isAvailable = filters.isAvailable;
    }
    if (filters.restaurantId) {
      baseMatch.restaurantId = filters.restaurantId;
    }

    const cursor = decodeCursor<ScoreCursor>(params.cursor);
    const pipeline: PipelineStage[] = [
      { $match: baseMatch },
      { $addFields: { _score: { $meta: 'textScore' } } },
    ];
    if (cursor) {
      pipeline.push({
        $match: {
          $or: [
            { _score: { $lt: cursor.s } },
            { _score: cursor.s, _id: { $gt: cursor.i } },
          ],
        },
      });
    }
    pipeline.push({ $sort: { _score: -1, _id: 1 } }, { $limit: limit + 1 });

    const docs = await MenuItemSearchModel.aggregate<
      MenuItemSearchDocument & { _score: number }
    >(pipeline);

    const collected = docs.map((doc) => ({
      view: this.toItemSearchView(doc),
      cursor: { s: doc._score, i: doc._id } as ScoreCursor,
    }));

    return this.toPage(collected, limit);
  }

  async nearby(
    point: GeoPoint,
    radiusMeters: number,
    filters: RestaurantSearchFilters = {},
    params: CursorPaginationParams = {}
  ): Promise<CursorPage<RestaurantSummaryView>> {
    const limit = normalizeLimit(params.limit);
    const geoJson = point.toGeoJson();
    const queryFilter: Record<string, unknown> = { ...PUBLIC_RESTAURANT_FILTER };
    if (filters.cuisineTypes && filters.cuisineTypes.length > 0) {
      queryFilter.cuisineTypes = { $in: filters.cuisineTypes };
    }

    const now = new Date();
    const wantsOpenFilter = filters.isOpenNow !== undefined;
    const collected: Array<{ view: RestaurantSummaryView; cursor: DistanceCursor }> = [];
    let cursor = decodeCursor<DistanceCursor>(params.cursor);
    let exhausted = false;

    while (collected.length <= limit && !exhausted) {
      const pipeline: PipelineStage[] = [
        {
          $geoNear: {
            near: { type: 'Point', coordinates: geoJson.coordinates },
            distanceField: '_dist',
            maxDistance: radiusMeters,
            spherical: true,
            query: queryFilter,
          },
        },
      ];
      if (cursor) {
        pipeline.push({
          $match: {
            $or: [
              { _dist: { $gt: cursor.d } },
              { _dist: cursor.d, _id: { $gt: cursor.i } },
            ],
          },
        });
      }
      pipeline.push({ $sort: { _dist: 1, _id: 1 } }, { $limit: limit + 1 });

      const docs = await RestaurantSummaryModel.aggregate<
        RestaurantSummaryDocument & { _dist: number }
      >(pipeline);

      if (docs.length === 0) {
        exhausted = true;
        break;
      }

      for (const doc of docs) {
        cursor = { d: doc._dist, i: doc._id };
        const view = this.toSummaryView(doc, now);
        if (wantsOpenFilter && view.isOpen !== filters.isOpenNow) continue;
        collected.push({ view, cursor });
        if (collected.length > limit) break;
      }

      if (docs.length <= limit) exhausted = true;
      if (!wantsOpenFilter) break;
    }

    return this.toPage(collected, limit);
  }

  private toPage<V, C extends ScoreCursor | DistanceCursor>(
    collected: Array<{ view: V; cursor: C }>,
    limit: number
  ): CursorPage<V> {
    const hasMore = collected.length > limit;
    const page = hasMore ? collected.slice(0, limit) : collected;
    return {
      items: page.map((p) => p.view),
      nextCursor: hasMore ? encodeCursor(page[page.length - 1].cursor) : undefined,
    };
  }

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

  private toItemSearchView(doc: MenuItemSearchDocument): MenuItemSearchView {
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
      isAvailable: doc.isAvailable,
      restaurantName: doc.restaurantName,
      restaurantSlug: doc.restaurantSlug,
    };
  }
}
