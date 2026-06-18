import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoReviewEligibilityRepository } from '../../../infrastructure/repositories/ReviewEligibilityRepository';
import { ReviewEligibilityModel } from '../../../infrastructure/database/models/ReviewEligibilityModel';
import { ReviewEligibility } from '../../../domain/engagement/repositories/IReviewEligibilityRepository';

function buildEligibility(overrides: Partial<ReviewEligibility> = {}): ReviewEligibility {
  return {
    fulfillmentId: 'ful-1',
    customerId: 'cust-1',
    restaurantId: 'rest-1',
    deliveredAt: null,
    reviewed: false,
    ...overrides,
  };
}

describe('MongoReviewEligibilityRepository', () => {
  let txContext: TransactionContext;
  let repo: MongoReviewEligibilityRepository;

  beforeEach(() => {
    txContext = new TransactionContext();
    repo = new MongoReviewEligibilityRepository(txContext);
  });

  afterEach(async () => {
    await ReviewEligibilityModel.deleteMany({});
  });

  it('upserts a new eligibility (seeded at FulfillmentCreated) and finds it by fulfillmentId', async () => {
    await repo.upsert(buildEligibility());

    const found = await repo.findByFulfillmentId('ful-1');
    expect(found).toEqual(buildEligibility());
  });

  it('upsert is idempotent — re-upserting (deliveredAt set at DeliveryCompleted) replaces, not duplicates', async () => {
    await repo.upsert(buildEligibility());

    const deliveredAt = new Date('2024-01-01T00:00:00.000Z');
    await repo.upsert(buildEligibility({ deliveredAt }));

    const count = await ReviewEligibilityModel.countDocuments({ _id: 'ful-1' });
    expect(count).toBe(1);

    const found = await repo.findByFulfillmentId('ful-1');
    expect(found!.deliveredAt).toEqual(deliveredAt);
  });

  it('markReviewed flips reviewed to true', async () => {
    await repo.upsert(buildEligibility());
    await repo.markReviewed('ful-1');

    const found = await repo.findByFulfillmentId('ful-1');
    expect(found!.reviewed).toBe(true);
  });

  it('returns null for an unknown fulfillmentId', async () => {
    const found = await repo.findByFulfillmentId('does-not-exist');
    expect(found).toBeNull();
  });
});
