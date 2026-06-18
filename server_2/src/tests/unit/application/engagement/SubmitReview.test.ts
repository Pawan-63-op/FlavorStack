import { SubmitReview } from '../../../../application/engagement/use-cases/SubmitReview';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { ConflictError } from '../../../../domain/shared/errors/ConflictError';
import { ReviewEligibility } from '../../../../domain/engagement/repositories/IReviewEligibilityRepository';
import {
  makeReviewRepo,
  makeEligibilityRepo,
  makeUnitOfWork,
  makeOutbox,
  makeEventBus,
} from './_helpers';

function eligibility(overrides: Partial<ReviewEligibility> = {}): ReviewEligibility {
  return {
    fulfillmentId: 'ful-1',
    customerId: 'cust-1',
    restaurantId: 'rest-1',
    deliveredAt: new Date('2026-01-01T00:00:00Z'),
    reviewed: false,
    ...overrides,
  };
}

const baseDto = {
  customerId: 'cust-1',
  restaurantId: 'rest-1',
  fulfillmentId: 'ful-1',
  restaurantRating: 5,
  deliveryRating: 4,
  comment: 'Great food',
};

function build(eligibilityOverrides: Partial<ReviewEligibility> | null = {}, reviewExists = false) {
  const elig = makeEligibilityRepo({
    findByFulfillmentId: jest
      .fn()
      .mockResolvedValue(eligibilityOverrides === null ? null : eligibility(eligibilityOverrides)),
  });
  const reviewRepo = makeReviewRepo(
    reviewExists ? { findByCustomerAndFulfillment: jest.fn().mockResolvedValue({} as never) } : {}
  );
  const outbox = makeOutbox();
  const bus = makeEventBus();
  const uc = new SubmitReview(reviewRepo, elig, makeUnitOfWork(), outbox, bus);
  return { uc, reviewRepo, elig, outbox, bus };
}

describe('SubmitReview', () => {
  it('submits a review: saves, appends ReviewSubmitted, marks eligibility reviewed, publishes', async () => {
    const { uc, reviewRepo, elig, outbox, bus } = build();

    const result = await uc.execute(baseDto);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().restaurantRating).toBe(5);
    expect(result.getValue().moderationStatus).toBe('PENDING');
    expect(reviewRepo.save).toHaveBeenCalledTimes(1);
    expect(outbox.append).toHaveBeenCalledTimes(1);
    expect(outbox.append.mock.calls[0][0][0].eventName).toBe('ReviewSubmitted');
    expect(elig.markReviewed).toHaveBeenCalledWith('ful-1');
    expect(bus.publishAll).toHaveBeenCalledTimes(1);
  });

  it('auto-flags a review whose comment contains profanity', async () => {
    const { uc } = build();
    const result = await uc.execute({ ...baseDto, comment: 'this is shit' });
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().moderationStatus).toBe('AUTO_FLAGGED');
  });

  it('rejects when no eligibility record exists', async () => {
    const { uc, reviewRepo } = build(null);
    const result = await uc.execute(baseDto);
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
    expect(reviewRepo.save).not.toHaveBeenCalled();
  });

  it('rejects when the fulfillment has not been delivered', async () => {
    const { uc } = build({ deliveredAt: null });
    const result = await uc.execute(baseDto);
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('rejects when the customer does not own the fulfillment', async () => {
    const { uc } = build({ customerId: 'someone-else' });
    const result = await uc.execute(baseDto);
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
  });

  it('rejects when the eligibility is already reviewed', async () => {
    const { uc } = build({ reviewed: true });
    const result = await uc.execute(baseDto);
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ConflictError);
  });

  it('rejects a duplicate (customer, fulfillment) review', async () => {
    const { uc } = build({}, true);
    const result = await uc.execute(baseDto);
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ConflictError);
  });

  it('rejects when the path restaurantId does not match the eligibility', async () => {
    const { uc } = build({ restaurantId: 'rest-2' });
    const result = await uc.execute(baseDto);
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
  });

  it('rejects an out-of-range rating without persisting', async () => {
    const { uc, reviewRepo } = build();
    const result = await uc.execute({ ...baseDto, restaurantRating: 9 });
    expect(result.isFailure).toBe(true);
    expect(reviewRepo.save).not.toHaveBeenCalled();
  });
});
