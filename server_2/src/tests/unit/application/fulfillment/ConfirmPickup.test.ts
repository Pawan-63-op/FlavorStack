import { ConfirmPickup } from '../../../../application/fulfillment/use-cases/ConfirmPickup';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { FULFILLMENT_STATUS } from '../../../../domain/fulfillment/enums/fulfillment-status.enum';
import { Fulfillment } from '../../../../domain/fulfillment/entities/Fulfillment';
import { buildReadyFulfillment, makeRepo, makeUnitOfWork, makeEventBus } from './assignment-uc-fixtures';

function readyAccepted(riderId = 'rider-1'): Fulfillment {
  const f = buildReadyFulfillment();
  f.offerToRider(riderId, new Date(Date.now() + 60_000));
  f.acceptByRider(riderId);
  f.pullDomainEvents();
  return f;
}

describe('ConfirmPickup', () => {
  it('confirms pickup by the assigned rider, appends PickupConfirmed, publishes', async () => {
    const f = readyAccepted('rider-1');
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const bus = makeEventBus();
    const uc = new ConfirmPickup(repo, makeUnitOfWork(), bus);

    const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: 'rider-1' });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().status).toBe(FULFILLMENT_STATUS.PICKED_UP);
    expect(repo.update).toHaveBeenCalledTimes(1);
    const events = bus.publishAll.mock.calls[0][0];
    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe('PickupConfirmed');
    expect(bus.publishAll).toHaveBeenCalledTimes(1);
  });

  it('forbids pickup by a different rider (no persistence)', async () => {
    const f = readyAccepted('rider-1');
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const bus = makeEventBus();
    const uc = new ConfirmPickup(repo, makeUnitOfWork(), bus);

    const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: 'rider-2' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
    expect(repo.update).not.toHaveBeenCalled();
    expect(bus.publishAll).not.toHaveBeenCalled();
  });

  it('returns NotFoundError for an unknown fulfillment', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new ConfirmPickup(repo, makeUnitOfWork(), makeEventBus());

    const result = await uc.execute({ fulfillmentId: 'nope', riderId: 'r' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });
});
