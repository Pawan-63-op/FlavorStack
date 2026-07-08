import { Review } from '../entities/Review';
import { ModerationStatusValue } from '../enums/moderation-status.enum';

export interface FindReviewsQuery {
  limit?: number;
  offset?: number;
}

export interface IReviewRepository {
  save(review: Review): Promise<void>;
  update(review: Review): Promise<void>;
  findById(id: string): Promise<Review | null>;
  findByCustomerAndFulfillment(customerId: string, fulfillmentId: string): Promise<Review | null>;
  findByRestaurant(restaurantId: string, status?: ModerationStatusValue, query?: FindReviewsQuery): Promise<Review[]>;
  findByCustomer(customerId: string, query?: FindReviewsQuery): Promise<Review[]>;
  findByModerationStatus(status: ModerationStatusValue, query?: FindReviewsQuery): Promise<Review[]>;
}
