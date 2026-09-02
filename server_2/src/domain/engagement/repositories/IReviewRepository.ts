import { Review } from '../entities/Review';
import { ModerationStatusValue } from '../enums/moderation-status.enum';

export interface FindReviewsQuery {
  limit?: number;
  offset?: number;
}

/** Star-count histogram; every bucket is present, zero-filled. */
export interface RestaurantRatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

/**
 * A restaurant's public rating, computed on read from the APPROVED reviews themselves.
 *
 * This replaced `restaurant_rating_views`, which was never event-driven — it was a full
 * recompute-and-replace triggered synchronously after moderation, i.e. a hand-maintained
 * cache of this aggregation. Computing it on read also removes the "rating only moves when
 * an admin approves" surprise: rejecting or deleting a review is reflected immediately.
 */
export interface RestaurantRatingAggregate {
  restaurantId: string;
  /** Mean restaurant rating over APPROVED reviews, rounded to 2 decimals. `0` when none. */
  avgRating: number;
  reviewCount: number;
  distribution: RestaurantRatingDistribution;
}

export interface IReviewRepository {
  save(review: Review): Promise<void>;
  update(review: Review): Promise<void>;
  findById(id: string): Promise<Review | null>;
  findByCustomerAndFulfillment(customerId: string, fulfillmentId: string): Promise<Review | null>;
  findByRestaurant(restaurantId: string, status?: ModerationStatusValue, query?: FindReviewsQuery): Promise<Review[]>;
  findByCustomer(customerId: string, query?: FindReviewsQuery): Promise<Review[]>;
  findByModerationStatus(status: ModerationStatusValue, query?: FindReviewsQuery): Promise<Review[]>;

  /**
   * Aggregate the APPROVED reviews for one restaurant into its rating summary. Always
   * resolves — a restaurant with no approved reviews yields zeros, not `null`.
   */
  aggregateRating(restaurantId: string): Promise<RestaurantRatingAggregate>;
}
