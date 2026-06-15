// MongoDB implementation of ICartRepository (Commerce Phase 3).
//
// Persists the Cart aggregate (with embedded CartItem entities) to the `carts`
// collection. All translation goes through CartMapper — the repository never
// accepts or returns Mongoose documents.
//
// Session propagation: the active Mongo ClientSession is read implicitly from the
// shared TransactionContext (AsyncLocalStorage) and attached to every operation,
// mirroring MongoRestaurantRepository / MongoUserRepository.
//
// Optimistic locking: `save` is upsert-style. It guards the update on the
// `version` present at load (`persistedVersion`); a non-match means a concurrent
// writer already advanced the document. If the cart was never persisted
// (persistedVersion === 0 and no document matched), it is inserted instead. A
// duplicate-key error on that insert means a concurrent writer won first, which
// also surfaces as ConflictError.
import type { ClientSession } from 'mongoose';
import { ICartRepository } from '../../domain/commerce/repositories/ICartRepository';
import { Cart } from '../../domain/commerce/entities/Cart';
import { ConflictError } from '../../domain/shared/errors/ConflictError';
import { TransactionContext } from '../database/TransactionContext';
import { CartModel, CartDocument } from '../database/models/CartModel';
import { CartMapper } from '../database/mappers/CartMapper';

/** MongoDB duplicate-key (11000) error. */
function isDuplicateKeyError(err: unknown): boolean {
  const e = err as { code?: number };
  return e?.code === 11000;
}

export class MongoCartRepository implements ICartRepository {
  constructor(private readonly txContext: TransactionContext) {}

  private get session(): ClientSession | undefined {
    return this.txContext.getSession();
  }

  async findById(id: string): Promise<Cart | null> {
    const doc = await CartModel.findOne({ _id: id }, null, { session: this.session }).lean<CartDocument>();
    return doc ? CartMapper.toDomain(doc) : null;
  }

  async findByCustomerId(customerId: string): Promise<Cart | null> {
    const doc = await CartModel.findOne({ customerId }, null, {
      session: this.session,
    }).lean<CartDocument>();
    return doc ? CartMapper.toDomain(doc) : null;
  }

  async save(cart: Cart): Promise<void> {
    const doc = CartMapper.toPersistence(cart) as unknown as Record<string, unknown>;
    const fields = { ...doc };
    delete fields._id;
    delete fields.createdAt;
    delete fields.updatedAt;

    const result = await CartModel.findOneAndUpdate(
      { _id: cart.id.toString(), version: cart.persistedVersion },
      { $set: fields },
      { session: this.session }
    );

    if (result !== null) {
      return;
    }

    if (cart.persistedVersion === 0) {
      // No document matched the version-0 guard: either this cart has never
      // been persisted (insert it), or a concurrent writer already advanced it
      // past version 0 (duplicate _id on insert -> ConflictError below).
      try {
        await CartModel.create([CartMapper.toPersistence(cart)], { session: this.session });
        return;
      } catch (err) {
        if (!isDuplicateKeyError(err)) throw err;
      }
    }

    throw new ConflictError('Optimistic lock conflict: cart was modified or removed concurrently', {
      id: cart.id.toString(),
      expectedVersion: cart.persistedVersion,
    });
  }

  async delete(id: string): Promise<void> {
    await CartModel.deleteOne({ _id: id }, { session: this.session });
  }
}
