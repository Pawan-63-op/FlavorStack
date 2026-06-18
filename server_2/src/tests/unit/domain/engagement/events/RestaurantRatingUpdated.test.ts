import { RestaurantRatingUpdated } from '../../../../../domain/engagement/events/RestaurantRatingUpdated';

describe('RestaurantRatingUpdated domain event', () => {
  it('carries the recomputed rating payload', () => {
    const event = new RestaurantRatingUpdated({
      restaurantId: 'rest-1',
      avgRating: 4.5,
      reviewCount: 10,
    });

    expect(event.eventName).toBe('RestaurantRatingUpdated');
    expect(event.aggregateId).toBe('rest-1');
    expect(event.avgRating).toBe(4.5);
    expect(event.reviewCount).toBe(10);
  });
});
