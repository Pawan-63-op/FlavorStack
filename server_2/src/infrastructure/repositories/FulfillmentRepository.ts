import type { ClientSession } from 'mongoose';
import { IFulfillmentRepository } from '../../domain/fulfillment/repositories/IFulfillmentRepository';
import { Fulfillment } from '../../domain/fulfillment/entities/Fulfillment';
import { ConflictError } from '../../domain/shared/errors/ConflictError';
import { TransactionContext } from '../database/TransactionContext';
import { FulfillmentModel, FulfillmentDocument } from '../database/models/FulfillmentModel';
import { FulfillmentMapper } from '../database/mappers/FulfillmentMapper';

function isDuplicateKeyError(err: unknown): boolean {
  const e = err as { code?: number };
  return e?.code === 11000;
}

export class MongoFulfillmentRepository implements IFulfillmentRepository {
  constructor(private readonly txContext: TransactionContext) {}

  private get session(): ClientSession | undefined {
    return this.txContext.getSession();
  }

  async findById(id: string): Promise<Fulfillment | null> {
    const doc = await FulfillmentModel.findOne({ _id: id }, null, {
      session: this.session,
    }).lean<FulfillmentDocument>();
    return doc ? FulfillmentMapper.toDomain(doc) : null;
  }

  async findByOrderRequestId(orderRequestId: string): Promise<Fulfillment | null> {
    const doc = await FulfillmentModel.findOne({ orderRequestId }, null, {
      session: this.session,
    }).lean<FulfillmentDocument>();
    return doc ? FulfillmentMapper.toDomain(doc) : null;
  }

  async findActiveByRestaurant(restaurantId: string, status?: string): Promise<Fulfillment[]> {
    const query: Record<string, unknown> = { restaurantId };
    if (status) {
      query.fulfillmentStatus = status;
    }
    const docs = await FulfillmentModel.find(query, null, {
      session: this.session,
    })
      .sort({ createdAt: -1 })
      .lean<FulfillmentDocument[]>();
    return docs.map(FulfillmentMapper.toDomain);
  }

  async save(fulfillment: Fulfillment): Promise<void> {
    try {
      await FulfillmentModel.create([FulfillmentMapper.toPersistence(fulfillment)], {
        session: this.session,
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new ConflictError('Fulfillment already exists for this id or orderRequestId', {
          id: fulfillment.id.toString(),
          orderRequestId: fulfillment.orderRequestId,
        });
      }
      throw err;
    }
  }

  async update(fulfillment: Fulfillment): Promise<void> {
    const doc = FulfillmentMapper.toPersistence(fulfillment);
    const result = await FulfillmentModel.updateOne(
      { _id: doc._id, version: fulfillment.persistedVersion },
      {
        $set: {
          fulfillmentStatus: doc.fulfillmentStatus,
          deliveryStatus: doc.deliveryStatus,
          currentAssignment: doc.currentAssignment,
          assignmentHistory: doc.assignmentHistory,
          cancellation: doc.cancellation,
          failureReason: doc.failureReason,
          prepEstimateMinutes: doc.prepEstimateMinutes,
          readyAt: doc.readyAt,
          pickedUpAt: doc.pickedUpAt,
          deliveredAt: doc.deliveredAt,
          updatedAt: doc.updatedAt,
          version: doc.version,
        },
      },
      { session: this.session }
    );

    if (result.matchedCount === 0) {
      throw new ConflictError('Fulfillment version conflict — concurrent modification detected', {
        id: fulfillment.id.toString(),
      });
    }
  }
}
