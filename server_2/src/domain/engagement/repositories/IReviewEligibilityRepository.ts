export interface ReviewEligibility {
  fulfillmentId: string;
  customerId: string;
  restaurantId: string;
  deliveredAt: Date | null;
  reviewed: boolean;
}

export interface IReviewEligibilityRepository {
  findByFulfillmentId(fulfillmentId: string): Promise<ReviewEligibility | null>;
  upsert(eligibility: ReviewEligibility): Promise<void>;
  markReviewed(fulfillmentId: string): Promise<void>;
}
