import { FailDelivery } from '../../../../application/fulfillment/use-cases/FailDelivery';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { FULFILLMENT_STATUS } from '../../../../domain/fulfillment/enums/fulfillment-status.enum';
import { FAILURE_REASON } from '../../../../domain/fulfillment/enums/failure-reason.enum';
import { Fulfillment } from '../../../../domain/fulfillment/entities/Fulfillment';
import { buildReadyFulfillment, makeRepo, makeUnitOfWork, makeOutbox, makeEventBus } from './assignment-uc-fixtures';

const RIDER_ID = 'rider-1';

/** A fulfillment with an ACCEPTED rider that has confirmed pickup (PICKED_UP). */
function buildPickedUp(): Fulfillment {
  const f = buildReadyFulfillment();
  f.offerToRider(RIDER_ID, new Date(Date.now() + 60_000));
  f.acceptByRider(RIDER_ID);
  f.confirmPickup(RIDER_ID);
  f.pullDomainEvents();
  return f;
}

describe('FailDelivery', () => {
  it('fails a PICKED_UP delivery, appends DeliveryFailed, publishes', async () => {
    const f = buildPickedUp();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const outbox = makeOutbox();
    const bus = makeEventBus();
    const uc = new FailDelivery(repo, makeUnitOfWork(), outbox, bus);

    const result = await uc.execute({
      fulfillmentId: f.id.toString(),
      riderId: RIDER_ID,
      failureReason: FAILURE_REASON.CUSTOMER_UNAVAILABLE,
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().status).toBe(FULFILLMENT_STATUS.FAILED);
    expect(result.getValue().failureReason).toBe(FAILURE_REASON.CUSTOMER_UNAVAILABLE);
    expect(repo.update).toHaveBeenCalledTimes(1);
    const events = outbox.append.mock.calls[0][0];
    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe('DeliveryFailed');
    expect(bus.publishAll).toHaveBeenCalledTimes(1);
  });

  it('does not persist when the aggregate rejects the failure (pre-pickup)', async () => {
    const f = buildReadyFulfillment();
    f.offerToRider(RIDER_ID, new Date(Date.now() + 60_000));
    f.acceptByRider(RIDER_ID);
    f.pullDomainEvents();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const outbox = makeOutbox();
    const uc = new FailDelivery(repo, makeUnitOfWork(), outbox, makeEventBus());

    const result = await uc.execute({
      fulfillmentId: f.id.toString(),
      riderId: RIDER_ID,
      failureReason: FAILURE_REASON.OTHER,
    });

    expect(result.isFailure).toBe(true);
    expect(repo.update).not.toHaveBeenCalled();
    expect(outbox.append).not.toHaveBeenCalled();
  });

  it('returns NotFoundError for an unknown fulfillment', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new FailDelivery(repo, makeUnitOfWork(), makeOutbox(), makeEventBus());
    const result = await uc.execute({
      fulfillmentId: 'nope',
      riderId: RIDER_ID,
      failureReason: FAILURE_REASON.OTHER,
    });
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });
});
