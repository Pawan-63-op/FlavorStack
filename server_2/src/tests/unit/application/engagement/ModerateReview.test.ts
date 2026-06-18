import { ModerateReview } from '../../../../application/engagement/use-cases/ModerateReview';
import { RecomputeRestaurantRating } from '../../../../application/engagement/use-cases/RecomputeRestaurantRating';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { Review } from '../../../../domain/engagement/entities/Review';
import { Result } from '../../../../domain/shared/Result';
import { makeReviewRepo, makeUnitOfWork, makeOutbox, makeEventBus } from './_helpers';

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
  const outbox = makeOutbox();
  const bus = makeEventBus();
  const recompute = { execute: jest.fn().mockResolvedValue(Result.ok(undefined)) } as unknown as RecomputeRestaurantRating;
  const uc = new ModerateReview(repo, makeUnitOfWork(), outbox, bus, recompute);
  return { uc, repo, outbox, bus, recompute };
}

describe('ModerateReview', () => {
  it('approves a review, appends ReviewModerated, publishes, and recomputes the rating', async () => {
    const review = buildReview();
    const { uc, repo, outbox, bus, recompute } = build(review);

    const result = await uc.execute({ moderatorId: 'mod-1', reviewId: review.id.toString(), action: 'APPROVE' });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().moderationStatus).toBe('APPROVED');
    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(outbox.append.mock.calls[0][0][0].eventName).toBe('ReviewModerated');
    expect(bus.publishAll).toHaveBeenCalledTimes(1);
    expect(recompute.execute).toHaveBeenCalledWith({ restaurantId: 'rest-1' });
  });

  it('rejects a review and does NOT recompute the rating', async () => {
    const review = buildReview();
    const { uc, recompute } = build(review);

    const result = await uc.execute({
      moderatorId: 'mod-1',
      reviewId: review.id.toString(),
      action: 'REJECT',
      reason: 'spam',
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().moderationStatus).toBe('REJECTED');
    expect(recompute.execute).not.toHaveBeenCalled();
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
    const { uc, repo, outbox } = build(review);
    const result = await uc.execute({ moderatorId: 'mod-2', reviewId: review.id.toString(), action: 'APPROVE' });
    expect(result.isFailure).toBe(true);
    expect(repo.update).not.toHaveBeenCalled();
    expect(outbox.append).not.toHaveBeenCalled();
  });
});
