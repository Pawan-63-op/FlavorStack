import { ReviewModerated } from '../../../../../domain/engagement/events/ReviewModerated';
import { MODERATION_STATUS } from '../../../../../domain/engagement/enums/moderation-status.enum';

describe('ReviewModerated domain event', () => {
  it('carries the moderation outcome payload', () => {
    const event = new ReviewModerated({
      reviewId: 'review-1',
      restaurantId: 'rest-1',
      status: MODERATION_STATUS.APPROVED,
      moderatorId: 'admin-1',
    });

    expect(event.eventName).toBe('ReviewModerated');
    expect(event.aggregateId).toBe('review-1');
    expect(event.restaurantId).toBe('rest-1');
    expect(event.status).toBe(MODERATION_STATUS.APPROVED);
    expect(event.moderatorId).toBe('admin-1');
  });
});
