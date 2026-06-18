// Port for the ReviewEligibility read model (engagement_module.md §7). Seeded from
// FulfillmentCreated (customer+restaurant) and updated by DeliveryCompleted (deliveredAt).
// Lets Engagement validate "who can review what" without touching Fulfillment/Commerce.
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
