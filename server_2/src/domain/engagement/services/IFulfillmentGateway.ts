/**
 * Engagement's read-only window onto the Fulfillment context, mirroring the
 * `ICatalogGateway` pattern Commerce already uses: a narrow port owned by the *consuming*
 * context, implemented in `infrastructure/services/` over the producing context's read
 * repository. Engagement never touches `fulfillments` or the `Fulfillment` aggregate.
 *
 * It replaces `review_eligibility` — a cross-context replica of these same three fields,
 * kept in sync by five event handlers, whose "row not seeded yet, skip and warn" retry
 * path was a symptom of replicating data that already had a source of truth.
 */

export interface ReviewSubject {
  fulfillmentId: string;
  /** The customer who placed the order — the only user allowed to review it. */
  customerId: string;
  restaurantId: string;
  /** Non-null iff the fulfillment was delivered. `null` means "not reviewable yet". */
  deliveredAt: Date | null;
}

export interface IFulfillmentGateway {
  /**
   * The review-relevant facts about one fulfillment, or `null` if it does not exist.
   * Callers derive eligibility from `deliveredAt` and ownership from `customerId`.
   */
  getForReview(fulfillmentId: string): Promise<ReviewSubject | null>;
}
