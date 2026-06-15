// Implements IOrderRequestRepository over OrderRequestModel via OrderRequestMapper. Write-once/append-only;
// duplicate checkout guarded by the unique idempotencyKey index. (Commerce Phase 11, commerce_module.md §6.)
//
// Session propagation: the active Mongo ClientSession is read implicitly from the shared TransactionContext
// (AsyncLocalStorage) and attached to every operation, mirroring MongoCartRepository — so `save` participates
// in the checkout transaction (order_requests row + outbox rows commit atomically, blueprint §4.4 step 8).
//
// `save` is a pure insert: OrderRequest is immutable, so there is no update path. A duplicate _id or
// idempotencyKey means a concurrent checkout already produced this order request; that surfaces as a
// ConflictError. The Checkout use case (Phase 11 Batch 4) checks findByIdempotencyKey first, so a duplicate
// here is the genuine race, not the normal replay path.
import type { ClientSession } from 'mongoose';
import { IOrderRequestRepository } from '../../domain/commerce/repositories/IOrderRequestRepository';
import { OrderRequest } from '../../domain/commerce/entities/OrderRequest';
import { ConflictError } from '../../domain/shared/errors/ConflictError';
import { TransactionContext } from '../database/TransactionContext';
import { OrderRequestModel, OrderRequestDocument } from '../database/models/OrderRequestModel';
import { OrderRequestMapper } from '../database/mappers/OrderRequestMapper';

/** MongoDB duplicate-key (11000) error. */
function isDuplicateKeyError(err: unknown): boolean {
  const e = err as { code?: number };
  return e?.code === 11000;
}

export class MongoOrderRequestRepository implements IOrderRequestRepository {
  constructor(private readonly txContext: TransactionContext) {}

  private get session(): ClientSession | undefined {
    return this.txContext.getSession();
  }

  async findById(id: string): Promise<OrderRequest | null> {
    const doc = await OrderRequestModel.findOne({ _id: id }, null, {
      session: this.session,
    }).lean<OrderRequestDocument>();
    return doc ? OrderRequestMapper.toDomain(doc) : null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<OrderRequest | null> {
    const doc = await OrderRequestModel.findOne({ idempotencyKey }, null, {
      session: this.session,
    }).lean<OrderRequestDocument>();
    return doc ? OrderRequestMapper.toDomain(doc) : null;
  }

  async save(orderRequest: OrderRequest): Promise<void> {
    try {
      await OrderRequestModel.create([OrderRequestMapper.toPersistence(orderRequest)], {
        session: this.session,
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new ConflictError('OrderRequest already exists for this id or idempotency key', {
          id: orderRequest.id.toString(),
          idempotencyKey: orderRequest.idempotencyKey.value,
        });
      }
      throw err;
    }
  }
}
