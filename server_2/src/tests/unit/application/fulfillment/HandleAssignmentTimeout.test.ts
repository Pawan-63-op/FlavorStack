import { HandleAssignmentTimeout } from '../../../../application/fulfillment/use-cases/HandleAssignmentTimeout';
import { AssignRider } from '../../../../application/fulfillment/use-cases/AssignRider';
import { CancelFulfillment } from '../../../../application/fulfillment/use-cases/CancelFulfillment';
import { Result } from '../../../../domain/shared/Result';
import { Fulfillment } from '../../../../domain/fulfillment/entities/Fulfillment';
import { CANCELLED_BY } from '../../../../domain/fulfillment/enums/cancelled-by.enum';
import { buildReadyFulfillment, makeRepo, makeUnitOfWork, makeEventBus } from './assignment-uc-fixtures';

const RIDER_1 = 'rider-1';
const T0 = new Date('2026-01-01T00:00:00Z');
const PAST_TTL = new Date('2026-01-01T00:02:00Z');

/** Build a fulfillment whose single OFFERED assignment (attempt 1) has lapsed its TTL. */
function buildExpiredOffer(): Fulfillment {
  jest.setSystemTime(T0);
  const f = buildReadyFulfillment();
  f.offerToRider(RIDER_1, new Date('2026-01-01T00:01:00Z'));
  f.pullDomainEvents();
  jest.setSystemTime(PAST_TTL);
  return f;
}

function mockOffer(): jest.Mocked<AssignRider> {
  return { execute: jest.fn().mockResolvedValue(Result.ok({})) } as unknown as jest.Mocked<AssignRider>;
}
function mockCancel(): jest.Mocked<CancelFulfillment> {
  return { execute: jest.fn().mockResolvedValue(Result.ok({})) } as unknown as jest.Mocked<CancelFulfillment>;
}

describe('HandleAssignmentTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('expires the lapsed offer and re-offers the next candidate when attempts remain', async () => {
    const f = buildExpiredOffer();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const offer = mockOffer();
    const cancel = mockCancel();
    const uc = new HandleAssignmentTimeout(repo, makeUnitOfWork(), makeEventBus(), offer, cancel, 3);

    const result = await uc.execute({ fulfillmentId: f.id.toString(), attempt: 1 });

    expect(result.isSuccess).toBe(true);
    expect(repo.update).toHaveBeenCalledTimes(1); // the expire mutation persisted
    expect(offer.execute).toHaveBeenCalledWith({ fulfillmentId: f.id.toString() });
    expect(cancel.execute).not.toHaveBeenCalled();
  });

  it('auto-cancels (SYSTEM) once the configured attempts are exhausted', async () => {
    const f = buildExpiredOffer();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const offer = mockOffer();
    const cancel = mockCancel();
    const uc = new HandleAssignmentTimeout(repo, makeUnitOfWork(), makeEventBus(), offer, cancel, 1);

    const result = await uc.execute({ fulfillmentId: f.id.toString(), attempt: 1 });

    expect(result.isSuccess).toBe(true);
    expect(cancel.execute).toHaveBeenCalledWith(
      expect.objectContaining({ fulfillmentId: f.id.toString(), cancelledBy: CANCELLED_BY.SYSTEM })
    );
    expect(offer.execute).not.toHaveBeenCalled();
  });

  it('is an idempotent no-op when the attempt no longer matches the live offer', async () => {
    const f = buildExpiredOffer();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const offer = mockOffer();
    const cancel = mockCancel();
    const uc = new HandleAssignmentTimeout(repo, makeUnitOfWork(), makeEventBus(), offer, cancel, 3);

    const result = await uc.execute({ fulfillmentId: f.id.toString(), attempt: 99 });

    expect(result.isSuccess).toBe(true);
    expect(repo.update).not.toHaveBeenCalled();
    expect(offer.execute).not.toHaveBeenCalled();
    expect(cancel.execute).not.toHaveBeenCalled();
  });

  it('is a no-op for a missing fulfillment', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new HandleAssignmentTimeout(repo, makeUnitOfWork(), makeEventBus(), mockOffer(), mockCancel(), 3);
    const result = await uc.execute({ fulfillmentId: 'nope', attempt: 1 });
    expect(result.isSuccess).toBe(true);
  });
});
