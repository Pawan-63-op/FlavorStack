import { RecomputeRestaurantRating } from '../../../../application/engagement/use-cases/RecomputeRestaurantRating';
import { MODERATION_STATUS } from '../../../../domain/engagement/enums/moderation-status.enum';
import { Review } from '../../../../domain/engagement/entities/Review';
import { makeReviewRepo, makeRatingViewRepo } from './_helpers';

function approvedReview(restaurantRating: number, fulfillmentId: string): Review {
  const r = Review.submit({
    customerId: 'c-' + fulfillmentId,
    restaurantId: 'rest-1',
    fulfillmentId,
    restaurantRating,
  }).getValue();
  r.pullDomainEvents();
  r.approve('mod-1');
  r.pullDomainEvents();
  return r;
}

describe('RecomputeRestaurantRating', () => {
  it('computes avg/count/distribution from approved reviews and upserts the view', async () => {
    const reviews = [approvedReview(5, 'f1'), approvedReview(3, 'f2'), approvedReview(4, 'f3'), approvedReview(5, 'f4')];
    const reviewRepo = makeReviewRepo({ findByRestaurant: jest.fn().mockResolvedValue(reviews) });
    const viewRepo = makeRatingViewRepo();
    const uc = new RecomputeRestaurantRating(reviewRepo, viewRepo);

    const result = await uc.execute({ restaurantId: 'rest-1' });

    expect(result.isSuccess).toBe(true);
    expect(reviewRepo.findByRestaurant).toHaveBeenCalledWith('rest-1', MODERATION_STATUS.APPROVED);
    expect(viewRepo.upsert).toHaveBeenCalledTimes(1);
    const view = viewRepo.upsert.mock.calls[0][0];
    expect(view.restaurantId).toBe('rest-1');
    expect(view.reviewCount).toBe(4);
    expect(view.avgRating).toBeCloseTo(4.25, 2); // (5+3+4+5)/4
    expect(view.distribution).toEqual({ 1: 0, 2: 0, 3: 1, 4: 1, 5: 2 });
  });

  it('writes a zeroed view when there are no approved reviews', async () => {
    const reviewRepo = makeReviewRepo({ findByRestaurant: jest.fn().mockResolvedValue([]) });
    const viewRepo = makeRatingViewRepo();
    const uc = new RecomputeRestaurantRating(reviewRepo, viewRepo);

    const result = await uc.execute({ restaurantId: 'rest-1' });

    expect(result.isSuccess).toBe(true);
    const view = viewRepo.upsert.mock.calls[0][0];
    expect(view.reviewCount).toBe(0);
    expect(view.avgRating).toBe(0);
    expect(view.distribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  });
});
