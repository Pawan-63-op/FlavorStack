// MongoDB implementation of IMenuItemRepository (Catalog Phase 8).
//
// Persists the MenuItem aggregate (with embedded variant groups/options) to the
// `menu_items` collection — a separate aggregate/collection from `restaurants`,
// referencing `restaurantId` + `categoryId`. All translation goes through
// MenuItemMapper; the repository never accepts or returns Mongoose documents.
//
// Session propagation, soft delete and optimistic locking follow the same patterns
// as MongoRestaurantRepository (session via TransactionContext, finders filter
// `deletedAt: null`, update guards on the domain `persistedVersion`).
import type { ClientSession } from 'mongoose';
import { IMenuItemRepository } from '../../domain/catalog/repositories/IMenuItemRepository';
import { MenuItem } from '../../domain/catalog/entities/MenuItem';
import { CursorPage, CursorPaginationParams } from '../../domain/catalog/types/CursorPagination';
import { ConflictError } from '../../domain/shared/errors/ConflictError';
import { TransactionContext } from '../database/TransactionContext';
import { MenuItemModel, MenuItemDocument } from '../database/models/MenuItemModel';
import { MenuItemMapper } from '../database/mappers/MenuItemMapper';

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

function normalizeLimit(limit?: number): number {
  if (!limit || limit < 1) return DEFAULT_PAGE_LIMIT;
  return Math.min(limit, MAX_PAGE_LIMIT);
}

export class MongoMenuItemRepository implements IMenuItemRepository {
  constructor(private readonly txContext: TransactionContext) {}

  private get session(): ClientSession | undefined {
    return this.txContext.getSession();
  }

  async save(menuItem: MenuItem): Promise<void> {
    const doc = MenuItemMapper.toPersistence(menuItem);
    await MenuItemModel.create([doc], { session: this.session });
  }

  async update(menuItem: MenuItem): Promise<void> {
    const doc = MenuItemMapper.toPersistence(menuItem) as unknown as Record<string, unknown>;
    const fields = { ...doc };
    delete fields._id;
    delete fields.createdAt;
    delete fields.updatedAt;

    const result = await MenuItemModel.findOneAndUpdate(
      { _id: menuItem.id.toString(), version: menuItem.persistedVersion },
      { $set: fields },
      { session: this.session }
    );

    if (result === null) {
      throw new ConflictError('Optimistic lock conflict: menu item was modified or removed concurrently', {
        id: menuItem.id.toString(),
        expectedVersion: menuItem.persistedVersion,
      });
    }
  }

  async softDelete(id: string): Promise<void> {
    await MenuItemModel.updateOne(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { session: this.session }
    );
  }

  async findById(id: string): Promise<MenuItem | null> {
    const doc = await MenuItemModel.findOne({ _id: id, deletedAt: null }, null, {
      session: this.session,
    }).lean<MenuItemDocument>();
    return doc ? MenuItemMapper.toDomain(doc) : null;
  }

  async findByRestaurant(restaurantId: string, params?: CursorPaginationParams): Promise<CursorPage<MenuItem>> {
    return this.paginate({ restaurantId, deletedAt: null }, params);
  }

  async findByCategory(categoryId: string, params?: CursorPaginationParams): Promise<CursorPage<MenuItem>> {
    return this.paginate({ categoryId, deletedAt: null }, params);
  }

  private async paginate(
    filter: Record<string, unknown>,
    params?: CursorPaginationParams
  ): Promise<CursorPage<MenuItem>> {
    const limit = normalizeLimit(params?.limit);
    const query: Record<string, unknown> = { ...filter };
    if (params?.cursor) {
      query._id = { $gt: params.cursor };
    }

    const docs = await MenuItemModel.find(query, null, { session: this.session })
      .sort({ _id: 1 })
      .limit(limit + 1)
      .lean<MenuItemDocument[]>();

    const hasMore = docs.length > limit;
    const page = hasMore ? docs.slice(0, limit) : docs;

    return {
      items: page.map(MenuItemMapper.toDomain),
      nextCursor: hasMore ? page[page.length - 1]._id : undefined,
    };
  }
}
