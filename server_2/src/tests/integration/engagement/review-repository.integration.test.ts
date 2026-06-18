import { randomUUID } from 'crypto';
import { Review } from '../../../domain/engagement/entities/Review';
import { MODERATION_STATUS } from '../../../domain/engagement/enums/moderation-status.enum';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoReviewRepository } from '../../../infrastructure/repositories/ReviewRepository';
import { ReviewModel } from '../../../infrastructure/database/models/ReviewModel';

function buildReview(overrides: { customerId?: string; fulfillmentId?: string; restaurantId?: string } = {}): Review {
  return Review.submit({
    customerId: overrides.customerId ?? `cust-${randomUUID()}`,
    restaurantId: overrides.restaurantId ?? `rest-${randomUUID()}`,
    fulfillmentId: overrides.fulfillmentId ?? `ful-${randomUUID()}`,
    restaurantRating: 5,
    deliveryRating: 4,
    comment: 'Great food, fast delivery',
  }).getValue();
}

describe('MongoReviewRepository', () => {
  let txContext: TransactionContext;
  let repo: MongoReviewRepository;

  beforeEach(() => {
    txContext = new TransactionContext();
    repo = new MongoReviewRepository(txContext);
  });

  afterEach(async () => {
    await ReviewModel.deleteMany({});
  });

  it('round-trips a review through save + findById, preserving Rating/ReviewComment VOs', async () => {
    const review = buildReview();
    await repo.save(review);

    const found = await repo.findById(review.id.toString());
    expect(found).toBeInstanceOf(Review);
    expect(found!.restaurantRating.value).toBe(5);
    expect(found!.deliveryRating!.value).toBe(4);
    expect(found!.comment!.value).toBe('Great food, fast delivery');
    expect(found!.moderationStatus.value).toBe(MODERATION_STATUS.PENDING);
  });

  it('round-trips a moderation transition through update', async () => {
    const review = buildReview();
    await repo.save(review);

    review.approve('moderator-1');
    await repo.update(review);

    const found = await repo.findById(review.id.toString());
    expect(found!.moderationStatus.value).toBe(MODERATION_STATUS.APPROVED);
    expect(found!.moderatedBy).toBe('moderator-1');
  });

  it('finds a review by customerId + fulfillmentId', async () => {
    const review = buildReview({ customerId: 'cust-fixed', fulfillmentId: 'ful-fixed' });
    await repo.save(review);

    const found = await repo.findByCustomerAndFulfillment('cust-fixed', 'ful-fixed');
    expect(found!.id.toString()).toBe(review.id.toString());
  });

  it('enforces a unique index on customerId+fulfillmentId', async () => {
    const customerId = `cust-${randomUUID()}`;
    const fulfillmentId = `ful-${randomUUID()}`;
    await repo.save(buildReview({ customerId, fulfillmentId }));
    await expect(repo.save(buildReview({ customerId, fulfillmentId }))).rejects.toThrow();
  });

  it('finds reviews by restaurant and moderation status', async () => {
    const restaurantId = `rest-${randomUUID()}`;
    const review = buildReview({ restaurantId });
    await repo.save(review);
    review.approve('moderator-1');
    await repo.update(review);

    const approved = await repo.findByRestaurant(restaurantId, MODERATION_STATUS.APPROVED);
    expect(approved).toHaveLength(1);

    const pending = await repo.findByRestaurant(restaurantId, MODERATION_STATUS.PENDING);
    expect(pending).toHaveLength(0);
  });

  it('finds reviews by moderation status across restaurants (admin queue)', async () => {
    await repo.save(buildReview());
    const pending = await repo.findByModerationStatus(MODERATION_STATUS.PENDING);
    expect(pending.length).toBeGreaterThanOrEqual(1);
  });
});
