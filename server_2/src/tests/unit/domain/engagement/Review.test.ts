import { Review } from '../../../../domain/engagement/entities/Review';
import { ReviewSubmitted } from '../../../../domain/engagement/events/ReviewSubmitted';
import { ReviewModerated } from '../../../../domain/engagement/events/ReviewModerated';
import { MODERATION_STATUS } from '../../../../domain/engagement/enums/moderation-status.enum';

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    customerId: 'cust-1',
    restaurantId: 'rest-1',
    fulfillmentId: 'fulfillment-1',
    restaurantRating: 5,
    deliveryRating: 4,
    comment: 'Great food, fast delivery!',
    ...overrides,
  };
}

describe('Review.submit', () => {
  it('creates a PENDING review and raises ReviewSubmitted', () => {
    const result = Review.submit(validInput());
    expect(result.isSuccess).toBe(true);

    const review = result.getValue();
    expect(review.moderationStatus.value).toBe(MODERATION_STATUS.PENDING);
    expect(review.restaurantRating.value).toBe(5);
    expect(review.deliveryRating?.value).toBe(4);
    expect(review.comment?.value).toBe('Great food, fast delivery!');

    const events = review.pullDomainEvents();
    expect(events).toHaveLength(1);
    const event = events[0] as ReviewSubmitted;
    expect(event).toBeInstanceOf(ReviewSubmitted);
    expect(event.aggregateId).toBe(review.id.toString());
    expect(event.customerId).toBe('cust-1');
    expect(event.restaurantId).toBe('rest-1');
    expect(event.fulfillmentId).toBe('fulfillment-1');
    expect(event.hasComment).toBe(true);
    expect(event.moderationStatus).toBe(MODERATION_STATUS.PENDING);
  });

  it('allows submitting without a delivery rating or comment', () => {
    const result = Review.submit(validInput({ deliveryRating: null, comment: null }));
    expect(result.isSuccess).toBe(true);
    const review = result.getValue();
    expect(review.deliveryRating).toBeNull();
    expect(review.comment).toBeNull();
    expect(review.pullDomainEvents()[0] as ReviewSubmitted).toMatchObject({ hasComment: false });
  });

  it.each([0, 6, -1])('rejects an out-of-range restaurantRating %i', (rating) => {
    expect(Review.submit(validInput({ restaurantRating: rating })).isFailure).toBe(true);
  });

  it('rejects an out-of-range deliveryRating', () => {
    expect(Review.submit(validInput({ deliveryRating: 7 })).isFailure).toBe(true);
  });

  it('rejects a comment over 1000 characters', () => {
    expect(Review.submit(validInput({ comment: 'a'.repeat(1001) })).isFailure).toBe(true);
  });

  it('auto-flags a review whose comment hits the profanity word list', () => {
    const result = Review.submit(validInput({ comment: 'this place is fucking terrible' }));
    expect(result.isSuccess).toBe(true);
    const review = result.getValue();
    expect(review.moderationStatus.value).toBe(MODERATION_STATUS.AUTO_FLAGGED);
    const event = review.pullDomainEvents()[0] as ReviewSubmitted;
    expect(event.moderationStatus).toBe(MODERATION_STATUS.AUTO_FLAGGED);
  });
});

describe('Review.editComment', () => {
  it('updates the comment while still PENDING', () => {
    const review = Review.submit(validInput()).getValue();
    const result = review.editComment('Updated comment text');
    expect(result.isSuccess).toBe(true);
    expect(review.comment?.value).toBe('Updated comment text');
  });

  it('fails once the review has been moderated', () => {
    const review = Review.submit(validInput()).getValue();
    review.approve('moderator-1');
    expect(review.editComment('Too late').isFailure).toBe(true);
  });
});

describe('Review.approve / Review.reject', () => {
  it('approve() transitions PENDING -> APPROVED and raises ReviewModerated', () => {
    const review = Review.submit(validInput()).getValue();
    review.pullDomainEvents();

    const result = review.approve('moderator-1');
    expect(result.isSuccess).toBe(true);
    expect(review.moderationStatus.value).toBe(MODERATION_STATUS.APPROVED);
    expect(review.moderatedBy).toBe('moderator-1');
    expect(review.moderatedAt).toBeInstanceOf(Date);

    const event = review.pullDomainEvents()[0] as ReviewModerated;
    expect(event).toBeInstanceOf(ReviewModerated);
    expect(event.aggregateId).toBe(review.id.toString());
    expect(event.status).toBe(MODERATION_STATUS.APPROVED);
    expect(event.moderatorId).toBe('moderator-1');
  });

  it('reject() transitions PENDING -> REJECTED and raises ReviewModerated', () => {
    const review = Review.submit(validInput()).getValue();
    review.pullDomainEvents();

    const result = review.reject('moderator-1', 'spam content');
    expect(result.isSuccess).toBe(true);
    expect(review.moderationStatus.value).toBe(MODERATION_STATUS.REJECTED);

    const event = review.pullDomainEvents()[0] as ReviewModerated;
    expect(event.status).toBe(MODERATION_STATUS.REJECTED);
  });

  it('cannot approve a review twice (terminal state)', () => {
    const review = Review.submit(validInput()).getValue();
    review.approve('moderator-1');
    expect(review.approve('moderator-1').isFailure).toBe(true);
  });

  it('rejects an empty moderatorId', () => {
    const review = Review.submit(validInput()).getValue();
    expect(review.approve('').isFailure).toBe(true);
  });
});
