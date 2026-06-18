import type { ClientSession } from 'mongoose';
import {
  IRestaurantRatingViewRepository,
  RestaurantRatingView,
} from '../../domain/engagement/repositories/IRestaurantRatingViewRepository';
import { TransactionContext } from '../database/TransactionContext';
import {
  RestaurantRatingViewModel,
  RestaurantRatingViewDocument,
} from '../database/models/RestaurantRatingViewModel';

function toDomain(doc: RestaurantRatingViewDocument): RestaurantRatingView {
  return {
    restaurantId: doc._id,
    avgRating: doc.avgRating,
    reviewCount: doc.reviewCount,
    distribution: doc.distribution,
    updatedAt: doc.updatedAt,
  };
}

export class MongoRestaurantRatingViewRepository implements IRestaurantRatingViewRepository {
  constructor(private readonly txContext: TransactionContext) {}

  private get session(): ClientSession | undefined {
    return this.txContext.getSession();
  }

  async findByRestaurantId(restaurantId: string): Promise<RestaurantRatingView | null> {
    const doc = await RestaurantRatingViewModel.findOne({ _id: restaurantId }, null, {
      session: this.session,
    }).lean<RestaurantRatingViewDocument>();
    return doc ? toDomain(doc) : null;
  }

  async upsert(view: RestaurantRatingView): Promise<void> {
    await RestaurantRatingViewModel.replaceOne(
      { _id: view.restaurantId },
      {
        _id: view.restaurantId,
        avgRating: view.avgRating,
        reviewCount: view.reviewCount,
        distribution: view.distribution,
        updatedAt: view.updatedAt,
      },
      { upsert: true, session: this.session }
    );
  }
}
