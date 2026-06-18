import { EditReviewComment } from '../../../../application/engagement/use-cases/EditReviewComment';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';
import { Review } from '../../../../domain/engagement/entities/Review';
import { makeReviewRepo } from './_helpers';

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

describe('EditReviewComment', () => {
  it('edits the comment of a not-yet-moderated review and persists it', async () => {
    const review = buildReview();
    const repo = makeReviewRepo({ findById: jest.fn().mockResolvedValue(review) });
    const uc = new EditReviewComment(repo);

    const result = await uc.execute({ customerId: 'cust-1', reviewId: review.id.toString(), comment: 'updated' });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().comment).toBe('updated');
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it('returns NotFoundError when the review does not exist', async () => {
    const repo = makeReviewRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new EditReviewComment(repo);
    const result = await uc.execute({ customerId: 'cust-1', reviewId: 'missing', comment: 'x' });
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('returns ForbiddenError when another customer tries to edit', async () => {
    const review = buildReview();
    const repo = makeReviewRepo({ findById: jest.fn().mockResolvedValue(review) });
    const uc = new EditReviewComment(repo);
    const result = await uc.execute({ customerId: 'intruder', reviewId: review.id.toString(), comment: 'x' });
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('returns failure when the review is already moderated', async () => {
    const review = buildReview();
    review.approve('mod-1');
    review.pullDomainEvents();
    const repo = makeReviewRepo({ findById: jest.fn().mockResolvedValue(review) });
    const uc = new EditReviewComment(repo);
    const result = await uc.execute({ customerId: 'cust-1', reviewId: review.id.toString(), comment: 'x' });
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
    expect(repo.update).not.toHaveBeenCalled();
  });
});
