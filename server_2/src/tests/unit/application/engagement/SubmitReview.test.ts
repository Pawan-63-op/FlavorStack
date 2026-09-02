import { SubmitReview } from '../../../../application/engagement/use-cases/SubmitReview';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { ConflictError } from '../../../../domain/shared/errors/ConflictError';
import { ReviewSubject } from '../../../../domain/engagement/services/IFulfillmentGateway';
import {
  makeReviewRepo,
  makeFulfillmentGateway,
  makeUnitOfWork,
  makeEventBus,
} from './_helpers';

const baseDto = {
  customerId: 'cust-1',
  restaurantId: 'rest-1',
  fulfillmentId: 'ful-1',
  restaurantRating: 5,
  deliveryRating: 4,
  comment: 'Great food',
};

function build(subjectOverrides: Partial<ReviewSubject> | null = {}, reviewExists = false) {
  const gateway = makeFulfillmentGateway(subjectOverrides);
  const reviewRepo = makeReviewRepo(
    reviewExists ? { findByCustomerAndFulfillment: jest.fn().mockResolvedValue({} as never) } : {}
  );
  const bus = makeEventBus();
  const uc = new SubmitReview(reviewRepo, gateway, makeUnitOfWork(), bus);
  return { uc, reviewRepo, gateway, bus };
}

describe('SubmitReview', () => {
  // Phase 6: `ReviewSubmitted` had no subscriber once the rating became a read-time aggregation,
  // so submission now persists state and raises nothing.
  it('submits a review: saves it and raises no domain event', async () => {
    const { uc, reviewRepo, gateway, bus } = build();

    const result = await uc.execute(baseDto);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().restaurantRating).toBe(5);
    expect(result.getValue().moderationStatus).toBe('PENDING');
    expect(reviewRepo.save).toHaveBeenCalledTimes(1);
    expect(gateway.getForReview).toHaveBeenCalledWith('ful-1');
    // Engagement defines no domain events, so the post-commit publish is a no-op with an
    // empty batch (it is still reached — this is the success path).
    expect(bus.publishAll).toHaveBeenCalledWith([]);
  });

  it('auto-flags a review whose comment contains profanity', async () => {
    const { uc } = build();
    const result = await uc.execute({ ...baseDto, comment: 'this is shit' });
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().moderationStatus).toBe('AUTO_FLAGGED');
  });

  it('rejects when the fulfillment does not exist', async () => {
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

  it('rejects a duplicate (customer, fulfillment) review', async () => {
    const { uc } = build({}, true);
    const result = await uc.execute(baseDto);
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ConflictError);
  });

  it('rejects when the path restaurantId does not match the fulfillment', async () => {
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
