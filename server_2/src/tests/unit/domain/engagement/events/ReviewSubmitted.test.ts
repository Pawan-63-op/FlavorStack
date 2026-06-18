import { ReviewSubmitted } from '../../../../../domain/engagement/events/ReviewSubmitted';
import { MODERATION_STATUS } from '../../../../../domain/engagement/enums/moderation-status.enum';

describe('ReviewSubmitted domain event', () => {
  it('carries the review submission payload', () => {
    const event = new ReviewSubmitted({
      reviewId: 'review-1',
      customerId: 'cust-1',
      restaurantId: 'rest-1',
      fulfillmentId: 'fulfillment-1',
      restaurantRating: 5,
      deliveryRating: 4,
      hasComment: true,
      moderationStatus: MODERATION_STATUS.PENDING,
    });

    expect(event.eventName).toBe('ReviewSubmitted');
    expect(event.aggregateId).toBe('review-1');
    expect(event.customerId).toBe('cust-1');
    expect(event.restaurantId).toBe('rest-1');
    expect(event.fulfillmentId).toBe('fulfillment-1');
    expect(event.restaurantRating).toBe(5);
    expect(event.deliveryRating).toBe(4);
    expect(event.hasComment).toBe(true);
    expect(event.moderationStatus).toBe(MODERATION_STATUS.PENDING);
    expect(event.eventId).toBeTruthy();
    expect(event.occurredOn).toBeInstanceOf(Date);
  });
});
