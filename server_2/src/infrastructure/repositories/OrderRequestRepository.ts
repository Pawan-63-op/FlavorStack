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
