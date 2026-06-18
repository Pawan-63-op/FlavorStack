import type { ClientSession } from 'mongoose';
import {
  IReviewEligibilityRepository,
  ReviewEligibility,
} from '../../domain/engagement/repositories/IReviewEligibilityRepository';
import { TransactionContext } from '../database/TransactionContext';
import { ReviewEligibilityModel, ReviewEligibilityDocument } from '../database/models/ReviewEligibilityModel';

function toDomain(doc: ReviewEligibilityDocument): ReviewEligibility {
  return {
    fulfillmentId: doc._id,
    customerId: doc.customerId,
    restaurantId: doc.restaurantId,
    deliveredAt: doc.deliveredAt,
    reviewed: doc.reviewed,
  };
}

export class MongoReviewEligibilityRepository implements IReviewEligibilityRepository {
  constructor(private readonly txContext: TransactionContext) {}

  private get session(): ClientSession | undefined {
    return this.txContext.getSession();
  }

  async findByFulfillmentId(fulfillmentId: string): Promise<ReviewEligibility | null> {
    const doc = await ReviewEligibilityModel.findOne({ _id: fulfillmentId }, null, {
      session: this.session,
    }).lean<ReviewEligibilityDocument>();
    return doc ? toDomain(doc) : null;
  }

  async upsert(eligibility: ReviewEligibility): Promise<void> {
    await ReviewEligibilityModel.replaceOne(
      { _id: eligibility.fulfillmentId },
      {
        _id: eligibility.fulfillmentId,
        customerId: eligibility.customerId,
        restaurantId: eligibility.restaurantId,
        deliveredAt: eligibility.deliveredAt,
        reviewed: eligibility.reviewed,
      },
      { upsert: true, session: this.session }
    );
  }

  async markReviewed(fulfillmentId: string): Promise<void> {
    await ReviewEligibilityModel.updateOne(
      { _id: fulfillmentId },
      { $set: { reviewed: true } },
      { session: this.session }
    );
  }
}
