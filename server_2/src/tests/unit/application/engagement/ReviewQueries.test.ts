import { GetRestaurantReviews } from '../../../../application/engagement/use-cases/GetRestaurantReviews';
import { GetMyReviews } from '../../../../application/engagement/use-cases/GetMyReviews';
import { GetRestaurantRating } from '../../../../application/engagement/use-cases/GetRestaurantRating';
import { ListPendingReviews } from '../../../../application/engagement/use-cases/ListPendingReviews';
import { MODERATION_STATUS } from '../../../../domain/engagement/enums/moderation-status.enum';
import { Review } from '../../../../domain/engagement/entities/Review';
import { RestaurantRatingAggregate } from '../../../../domain/engagement/repositories/IReviewRepository';
import { makeReviewRepo, zeroRating } from './_helpers';

function review(fulfillmentId: string, customerId = 'cust-1'): Review {
  const r = Review.submit({
    customerId,
    restaurantId: 'rest-1',
    fulfillmentId,
    restaurantRating: 4,
  }).getValue();
  r.pullDomainEvents();
  return r;
}

describe('GetRestaurantReviews', () => {
  it('returns only APPROVED reviews for the restaurant, paginated', async () => {
    const repo = makeReviewRepo({ findByRestaurant: jest.fn().mockResolvedValue([review('f1'), review('f2')]) });
    const uc = new GetRestaurantReviews(repo);

    const result = await uc.execute({ restaurantId: 'rest-1', limit: 10, offset: 0 });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toHaveLength(2);
    expect(repo.findByRestaurant).toHaveBeenCalledWith('rest-1', MODERATION_STATUS.APPROVED, { limit: 10, offset: 0 });
  });
});

describe('GetMyReviews', () => {
  it('returns the reviews authored by the customer', async () => {
    const repo = makeReviewRepo({ findByCustomer: jest.fn().mockResolvedValue([review('f1', 'cust-9')]) });
    const uc = new GetMyReviews(repo);

    const result = await uc.execute({ customerId: 'cust-9', limit: 20, offset: 0 });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()[0].customerId).toBe('cust-9');
    expect(repo.findByCustomer).toHaveBeenCalledWith('cust-9', { limit: 20, offset: 0 });
  });
});

describe('GetRestaurantRating', () => {
  it('returns the aggregation over APPROVED reviews', async () => {
    const aggregate: RestaurantRatingAggregate = {
      restaurantId: 'rest-1',
      avgRating: 4.5,
      reviewCount: 10,
      distribution: { 1: 0, 2: 0, 3: 1, 4: 3, 5: 6 },
    };
    const repo = makeReviewRepo({ aggregateRating: jest.fn().mockResolvedValue(aggregate) });
    const uc = new GetRestaurantRating(repo);

    const result = await uc.execute({ restaurantId: 'rest-1' });

    expect(repo.aggregateRating).toHaveBeenCalledWith('rest-1');
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().avgRating).toBe(4.5);
    expect(result.getValue().reviewCount).toBe(10);
    expect(result.getValue().distribution).toEqual({ 1: 0, 2: 0, 3: 1, 4: 3, 5: 6 });
  });

  it('returns a zeroed rating for a restaurant with no approved reviews', async () => {
    const repo = makeReviewRepo({
      aggregateRating: jest.fn().mockResolvedValue(zeroRating('rest-unknown')),
    });
    const uc = new GetRestaurantRating(repo);

    const result = await uc.execute({ restaurantId: 'rest-unknown' });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().restaurantId).toBe('rest-unknown');
    expect(result.getValue().avgRating).toBe(0);
    expect(result.getValue().reviewCount).toBe(0);
    expect(result.getValue().distribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  });
});

describe('ListPendingReviews', () => {
  it('defaults to PENDING when no status is supplied', async () => {
    const repo = makeReviewRepo({ findByModerationStatus: jest.fn().mockResolvedValue([review('f1')]) });
    const uc = new ListPendingReviews(repo);

    const result = await uc.execute({ limit: 50, offset: 0 });

    expect(result.isSuccess).toBe(true);
    expect(repo.findByModerationStatus).toHaveBeenCalledWith(MODERATION_STATUS.PENDING, { limit: 50, offset: 0 });
  });

  it('lists AUTO_FLAGGED reviews when requested', async () => {
    const repo = makeReviewRepo({ findByModerationStatus: jest.fn().mockResolvedValue([]) });
    const uc = new ListPendingReviews(repo);

    await uc.execute({ status: MODERATION_STATUS.AUTO_FLAGGED });

    expect(repo.findByModerationStatus).toHaveBeenCalledWith(MODERATION_STATUS.AUTO_FLAGGED, {
      limit: undefined,
      offset: undefined,
    });
  });
});
