import { ModerateReview } from '../../../../application/engagement/use-cases/ModerateReview';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { Review } from '../../../../domain/engagement/entities/Review';
import { makeReviewRepo, makeUnitOfWork, makeEventBus } from './_helpers';

function buildReview(): Review {
  const r = Review.submit({
    customerId: 'cust-1',
    restaurantId: 'rest-1',
    fulfillmentId: 'ful-1',
    restaurantRating: 4,
    comment: 'ok',
  }).getValue();
  r.pullDomainEvents();
  return r;
}

function build(review: Review | null) {
  const repo = makeReviewRepo({ findById: jest.fn().mockResolvedValue(review) });
  const bus = makeEventBus();
  const uc = new ModerateReview(repo, makeUnitOfWork(), bus);
  return { uc, repo, bus };
}

describe('ModerateReview', () => {
  // Phase 6: `ReviewModerated` had no subscriber once the rating became a read-time aggregation,
  // so moderation now persists state and raises nothing.
  it('approves a review and persists it, raising no domain event', async () => {
    const review = buildReview();
    const { uc, repo, bus } = build(review);

    const result = await uc.execute({ moderatorId: 'mod-1', reviewId: review.id.toString(), action: 'APPROVE' });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().moderationStatus).toBe('APPROVED');
    expect(repo.update).toHaveBeenCalledTimes(1);
    // Raises no domain event, but the success path still reaches the post-commit publish.
    expect(bus.publishAll).toHaveBeenCalledWith([]);
  });

  // The rating is aggregated on read now, so moderation has no second write to make.
  it('rejects a review without any rating write-back', async () => {
    const review = buildReview();
    const { uc, repo } = build(review);

    const result = await uc.execute({
      moderatorId: 'mod-1',
      reviewId: review.id.toString(),
      action: 'REJECT',
      reason: 'spam',
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().moderationStatus).toBe('REJECTED');
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it('returns NotFoundError when the review does not exist', async () => {
    const { uc, repo } = build(null);
    const result = await uc.execute({ moderatorId: 'mod-1', reviewId: 'missing', action: 'APPROVE' });
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('returns failure when rejecting without a reason', async () => {
    const review = buildReview();
    const { uc, repo } = build(review);
    const result = await uc.execute({ moderatorId: 'mod-1', reviewId: review.id.toString(), action: 'REJECT' });
    expect(result.isFailure).toBe(true);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('returns failure on an illegal transition (already approved) without persisting', async () => {
    const review = buildReview();
    review.approve('mod-1');
    review.pullDomainEvents();
    const { uc, repo, bus } = build(review);
    const result = await uc.execute({ moderatorId: 'mod-2', reviewId: review.id.toString(), action: 'APPROVE' });
    expect(result.isFailure).toBe(true);
    expect(repo.update).not.toHaveBeenCalled();
    expect(bus.publishAll).not.toHaveBeenCalled();
  });
});
