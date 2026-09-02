import { RejectDelivery } from '../../../../application/fulfillment/use-cases/RejectDelivery';
import { OfferRiderAssignment } from '../../../../application/fulfillment/use-cases/OfferRiderAssignment';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { ConflictError } from '../../../../domain/shared/errors/ConflictError';
import { Result } from '../../../../domain/shared/Result';
import { RIDER_ASSIGNMENT_STATUS } from '../../../../domain/fulfillment/enums/rider-assignment-status.enum';
import { buildReadyFulfillment, makeRepo, makeUnitOfWork, makeEventBus } from './assignment-uc-fixtures';

function offered(riderId = 'rider-1') {
  const f = buildReadyFulfillment();
  f.offerToRider(riderId, new Date(Date.now() + 60_000));
  f.pullDomainEvents();
  return f;
}

function makeOffer(result = Result.ok({} as never)): jest.Mocked<Pick<OfferRiderAssignment, 'execute'>> {
  return { execute: jest.fn().mockResolvedValue(result) } as jest.Mocked<Pick<OfferRiderAssignment, 'execute'>>;
}

describe('RejectDelivery', () => {
  it('rejects, persists history, frees the active slot, then triggers a re-offer', async () => {
    const f = offered('rider-1');
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const offer = makeOffer();
    const uc = new RejectDelivery(repo, makeUnitOfWork(), makeEventBus(), offer as unknown as OfferRiderAssignment);

    const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: 'rider-1' });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().currentAssignment).toBeNull();
    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(f.assignmentHistory).toHaveLength(1);
    expect(f.assignmentHistory[0].status.value).toBe(RIDER_ASSIGNMENT_STATUS.REJECTED);
    expect(offer.execute).toHaveBeenCalledWith({ fulfillmentId: f.id.toString() });
  });

  it('still succeeds when the re-offer finds no rider (best-effort)', async () => {
    const f = offered('rider-1');
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const offer = makeOffer(Result.fail(new ConflictError('no_available_rider')));
    const uc = new RejectDelivery(repo, makeUnitOfWork(), makeEventBus(), offer as unknown as OfferRiderAssignment);

    const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: 'rider-1' });

    expect(result.isSuccess).toBe(true);
    expect(offer.execute).toHaveBeenCalledTimes(1);
  });

  it('forbids rejection by a different rider and does not re-offer', async () => {
    const f = offered('rider-1');
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const offer = makeOffer();
    const uc = new RejectDelivery(repo, makeUnitOfWork(), makeEventBus(), offer as unknown as OfferRiderAssignment);

    const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: 'rider-2' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
    expect(repo.update).not.toHaveBeenCalled();
    expect(offer.execute).not.toHaveBeenCalled();
  });

  it('returns NotFoundError for an unknown fulfillment', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const offer = makeOffer();
    const uc = new RejectDelivery(repo, makeUnitOfWork(), makeEventBus(), offer as unknown as OfferRiderAssignment);

    const result = await uc.execute({ fulfillmentId: 'nope', riderId: 'r' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
    expect(offer.execute).not.toHaveBeenCalled();
  });
});
