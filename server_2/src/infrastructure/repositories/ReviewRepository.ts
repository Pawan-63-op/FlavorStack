import type { ClientSession } from 'mongoose';
import { IReviewRepository, FindReviewsQuery } from '../../domain/engagement/repositories/IReviewRepository';
import { Review } from '../../domain/engagement/entities/Review';
import { ModerationStatusValue } from '../../domain/engagement/enums/moderation-status.enum';
import { ConflictError } from '../../domain/shared/errors/ConflictError';
import { TransactionContext } from '../database/TransactionContext';
import { ReviewModel, ReviewDocument } from '../database/models/ReviewModel';
import { ReviewMapper } from '../database/mappers/ReviewMapper';

function isDuplicateKeyError(err: unknown): boolean {
  const e = err as { code?: number };
  return e?.code === 11000;
}

export class MongoReviewRepository implements IReviewRepository {
  constructor(private readonly txContext: TransactionContext) {}

  private get session(): ClientSession | undefined {
    return this.txContext.getSession();
  }

  async findById(id: string): Promise<Review | null> {
    const doc = await ReviewModel.findOne({ _id: id }, null, {
      session: this.session,
    }).lean<ReviewDocument>();
    return doc ? ReviewMapper.toDomain(doc) : null;
  }

  async findByCustomerAndFulfillment(customerId: string, fulfillmentId: string): Promise<Review | null> {
    const doc = await ReviewModel.findOne({ customerId, fulfillmentId }, null, {
      session: this.session,
    }).lean<ReviewDocument>();
    return doc ? ReviewMapper.toDomain(doc) : null;
  }

  async findByRestaurant(
    restaurantId: string,
    status?: ModerationStatusValue,
    query?: FindReviewsQuery
  ): Promise<Review[]> {
    const filter: Record<string, unknown> = { restaurantId };
    if (status) filter.moderationStatus = status;

    const docs = await ReviewModel.find(filter, null, { session: this.session })
      .sort({ createdAt: -1 })
      .skip(query?.offset ?? 0)
      .limit(query?.limit ?? 0)
      .lean<ReviewDocument[]>();
    return docs.map(ReviewMapper.toDomain);
  }

  async findByCustomer(customerId: string, query?: FindReviewsQuery): Promise<Review[]> {
    const docs = await ReviewModel.find({ customerId }, null, { session: this.session })
      .sort({ createdAt: -1 })
      .skip(query?.offset ?? 0)
      .limit(query?.limit ?? 0)
      .lean<ReviewDocument[]>();
    return docs.map(ReviewMapper.toDomain);
  }

  async findByModerationStatus(status: ModerationStatusValue, query?: FindReviewsQuery): Promise<Review[]> {
    const docs = await ReviewModel.find({ moderationStatus: status }, null, { session: this.session })
      .sort({ createdAt: -1 })
      .skip(query?.offset ?? 0)
      .limit(query?.limit ?? 0)
      .lean<ReviewDocument[]>();
    return docs.map(ReviewMapper.toDomain);
  }

  async save(review: Review): Promise<void> {
    try {
      await ReviewModel.create([ReviewMapper.toPersistence(review)], {
        session: this.session,
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new ConflictError('A review already exists for this customer and fulfillment', {
          customerId: review.customerId,
          fulfillmentId: review.fulfillmentId,
        });
      }
      throw err;
    }
  }

  async update(review: Review): Promise<void> {
    const doc = ReviewMapper.toPersistence(review);
    await ReviewModel.updateOne(
      { _id: doc._id },
      {
        $set: {
          comment: doc.comment,
          moderationStatus: doc.moderationStatus,
          moderatedAt: doc.moderatedAt,
          moderatedBy: doc.moderatedBy,
        },
      },
      { session: this.session }
    );
  }
}
