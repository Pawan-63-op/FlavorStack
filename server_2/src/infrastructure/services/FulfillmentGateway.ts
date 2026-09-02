import {
  IFulfillmentGateway,
  ReviewSubject,
} from '../../domain/engagement/services/IFulfillmentGateway';
import { IFulfillmentQueryRepository } from '../../domain/fulfillment/repositories/IFulfillmentQueryRepository';

/**
 * Anti-corruption layer between Engagement and Fulfillment. The translation is currently
 * a pass-through because `ReviewSubjectView` and `ReviewSubject` agree by construction;
 * the point of the seam is that Engagement compiles against its own port, so a change to
 * the fulfillment read shape lands here rather than in five event handlers.
 *
 * @see domain/engagement/services/IFulfillmentGateway.ts
 */
export class FulfillmentGateway implements IFulfillmentGateway {
  constructor(private readonly queryRepo: IFulfillmentQueryRepository) {}

  async getForReview(fulfillmentId: string): Promise<ReviewSubject | null> {
    const subject = await this.queryRepo.findReviewSubject(fulfillmentId);
    if (!subject) return null;

    return {
      fulfillmentId: subject.fulfillmentId,
      customerId: subject.customerId,
      restaurantId: subject.restaurantId,
      deliveredAt: subject.deliveredAt,
    };
  }
}
