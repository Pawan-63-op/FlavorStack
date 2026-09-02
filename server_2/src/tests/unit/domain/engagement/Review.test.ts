import { Review } from '../../../../domain/engagement/entities/Review';
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
  // Phase 6: `Review` raises no domain events — nothing subscribed to them once the rating
  // read model was replaced by an aggregation over `reviews` (Phase 4).
  it('creates a PENDING review and raises no domain event', () => {
    const result = Review.submit(validInput());
    expect(result.isSuccess).toBe(true);

    const review = result.getValue();
    expect(review.moderationStatus.value).toBe(MODERATION_STATUS.PENDING);
    expect(review.restaurantRating.value).toBe(5);
    expect(review.deliveryRating?.value).toBe(4);
    expect(review.comment?.value).toBe('Great food, fast delivery!');

    expect(review.customerId).toBe('cust-1');
    expect(review.restaurantId).toBe('rest-1');
    expect(review.fulfillmentId).toBe('fulfillment-1');
    expect(review.pullDomainEvents()).toEqual([]);
  });

  it('allows submitting without a delivery rating or comment', () => {
    const result = Review.submit(validInput({ deliveryRating: null, comment: null }));
    expect(result.isSuccess).toBe(true);
    const review = result.getValue();
    expect(review.deliveryRating).toBeNull();
    expect(review.comment).toBeNull();
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
  it('approve() transitions PENDING -> APPROVED, raising no domain event', () => {
    const review = Review.submit(validInput()).getValue();

    const result = review.approve('moderator-1');
    expect(result.isSuccess).toBe(true);
    expect(review.moderationStatus.value).toBe(MODERATION_STATUS.APPROVED);
    expect(review.moderatedBy).toBe('moderator-1');
    expect(review.moderatedAt).toBeInstanceOf(Date);
    expect(review.pullDomainEvents()).toEqual([]);
  });

  it('reject() transitions PENDING -> REJECTED, raising no domain event', () => {
    const review = Review.submit(validInput()).getValue();

    const result = review.reject('moderator-1', 'spam content');
    expect(result.isSuccess).toBe(true);
    expect(review.moderationStatus.value).toBe(MODERATION_STATUS.REJECTED);
    expect(review.pullDomainEvents()).toEqual([]);
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
