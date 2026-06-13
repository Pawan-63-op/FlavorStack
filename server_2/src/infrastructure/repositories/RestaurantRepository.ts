// MongoDB implementation of IRestaurantRepository (Catalog Phase 8).
//
// Persists the Restaurant aggregate (with embedded categories and delivery zones)
// to the `restaurants` collection. All translation goes through RestaurantMapper —
// the repository never accepts or returns Mongoose documents.
//
// Session propagation: the active Mongo ClientSession is read implicitly from the
// shared TransactionContext (AsyncLocalStorage) and attached to every operation, so
// a use-case can persist the aggregate and its outbox row in one transaction
// without threading a `ctx` through IRestaurantRepository.
//
// Soft delete: every finder filters `deletedAt: null`; softDelete sets `deletedAt`.
//
// Optimistic locking: the domain owns `version` (incremented per mutation). update
// guards on the version present at load (`persistedVersion`) and writes the new
// `version`; a non-match means a concurrent writer won (or the row is gone) and
// surfaces as a ConflictError.
import type { ClientSession } from 'mongoose';
import { IRestaurantRepository } from '../../domain/catalog/repositories/IRestaurantRepository';
import { Restaurant } from '../../domain/catalog/entities/Restaurant';
import { CursorPage, CursorPaginationParams } from '../../domain/catalog/types/CursorPagination';
import { ConflictError } from '../../domain/shared/errors/ConflictError';
import { TransactionContext } from '../database/TransactionContext';
import { RestaurantModel, RestaurantDocument } from '../database/models/RestaurantModel';
import { RestaurantMapper } from '../database/mappers/RestaurantMapper';

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

function normalizeLimit(limit?: number): number {
  if (!limit || limit < 1) return DEFAULT_PAGE_LIMIT;
  return Math.min(limit, MAX_PAGE_LIMIT);
}

export class MongoRestaurantRepository implements IRestaurantRepository {
  constructor(private readonly txContext: TransactionContext) {}

  private get session(): ClientSession | undefined {
    return this.txContext.getSession();
  }

  async save(restaurant: Restaurant): Promise<void> {
    const doc = RestaurantMapper.toPersistence(restaurant);
    // Array form is required to pass per-operation options (session).
    await RestaurantModel.create([doc], { session: this.session });
  }

  async update(restaurant: Restaurant): Promise<void> {
    const doc = RestaurantMapper.toPersistence(restaurant) as unknown as Record<string, unknown>;
    // `_id` is immutable and timestamps are schema-managed; `version` is written
    // explicitly (the domain already advanced it) under the optimistic-lock guard.
    const fields = { ...doc };
    delete fields._id;
    delete fields.createdAt;
    delete fields.updatedAt;

    const result = await RestaurantModel.findOneAndUpdate(
      { _id: restaurant.id.toString(), version: restaurant.persistedVersion },
      { $set: fields },
      { session: this.session }
    );

    if (result === null) {
      throw new ConflictError('Optimistic lock conflict: restaurant was modified or removed concurrently', {
        id: restaurant.id.toString(),
        expectedVersion: restaurant.persistedVersion,
      });
    }
  }

  async softDelete(id: string): Promise<void> {
    await RestaurantModel.updateOne(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { session: this.session }
    );
  }

  async findById(id: string): Promise<Restaurant | null> {
    const doc = await RestaurantModel.findOne({ _id: id, deletedAt: null }, null, {
      session: this.session,
    }).lean<RestaurantDocument>();
    return doc ? RestaurantMapper.toDomain(doc) : null;
  }

  async findBySlug(slug: string): Promise<Restaurant | null> {
    const doc = await RestaurantModel.findOne({ slug, deletedAt: null }, null, {
      session: this.session,
    }).lean<RestaurantDocument>();
    return doc ? RestaurantMapper.toDomain(doc) : null;
  }

  async findByOwner(ownerId: string, params?: CursorPaginationParams): Promise<CursorPage<Restaurant>> {
    return this.paginate({ ownerId, deletedAt: null }, params);
  }

  async findAll(params: CursorPaginationParams): Promise<CursorPage<Restaurant>> {
    return this.paginate({ deletedAt: null }, params);
  }

  // Stable forward-only cursor over the UUID `_id` (lexicographic). Fetches one
  // extra row to decide whether a further page exists.
  private async paginate(
    filter: Record<string, unknown>,
    params?: CursorPaginationParams
  ): Promise<CursorPage<Restaurant>> {
    const limit = normalizeLimit(params?.limit);
    const query: Record<string, unknown> = { ...filter };
    if (params?.cursor) {
      query._id = { $gt: params.cursor };
    }

    const docs = await RestaurantModel.find(query, null, { session: this.session })
      .sort({ _id: 1 })
      .limit(limit + 1)
      .lean<RestaurantDocument[]>();

    const hasMore = docs.length > limit;
    const page = hasMore ? docs.slice(0, limit) : docs;

    return {
      items: page.map(RestaurantMapper.toDomain),
      nextCursor: hasMore ? page[page.length - 1]._id : undefined,
    };
  }
}
