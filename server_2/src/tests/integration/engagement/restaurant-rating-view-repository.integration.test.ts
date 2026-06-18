import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoRestaurantRatingViewRepository } from '../../../infrastructure/repositories/RestaurantRatingViewRepository';
import { RestaurantRatingViewModel } from '../../../infrastructure/database/models/RestaurantRatingViewModel';
import { RestaurantRatingView } from '../../../domain/engagement/repositories/IRestaurantRatingViewRepository';

const FIXED_DATE = new Date('2024-01-01T00:00:00.000Z');

function buildView(overrides: Partial<RestaurantRatingView> = {}): RestaurantRatingView {
  return {
    restaurantId: 'rest-1',
    avgRating: 4.5,
    reviewCount: 2,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
    updatedAt: FIXED_DATE,
    ...overrides,
  };
}

describe('MongoRestaurantRatingViewRepository', () => {
  let txContext: TransactionContext;
  let repo: MongoRestaurantRatingViewRepository;

  beforeEach(() => {
    txContext = new TransactionContext();
    repo = new MongoRestaurantRatingViewRepository(txContext);
  });

  afterEach(async () => {
    await RestaurantRatingViewModel.deleteMany({});
  });

  it('upserts a new view and finds it by restaurantId', async () => {
    await repo.upsert(buildView());

    const found = await repo.findByRestaurantId('rest-1');
    expect(found).toEqual(buildView());
  });

  it('upsert is idempotent — re-upserting the same restaurantId replaces, not duplicates', async () => {
    await repo.upsert(buildView());
    await repo.upsert(buildView({ avgRating: 4.0, reviewCount: 3, distribution: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 1 } }));

    const count = await RestaurantRatingViewModel.countDocuments({ _id: 'rest-1' });
    expect(count).toBe(1);

    const found = await repo.findByRestaurantId('rest-1');
    expect(found!.avgRating).toBe(4.0);
    expect(found!.reviewCount).toBe(3);
  });

  it('returns null for an unknown restaurantId', async () => {
    const found = await repo.findByRestaurantId('does-not-exist');
    expect(found).toBeNull();
  });
});
