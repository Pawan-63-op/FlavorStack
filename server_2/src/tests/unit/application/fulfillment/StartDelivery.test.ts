import { StartDelivery } from '../../../../application/fulfillment/use-cases/StartDelivery';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { FULFILLMENT_STATUS } from '../../../../domain/fulfillment/enums/fulfillment-status.enum';
import { Fulfillment } from '../../../../domain/fulfillment/entities/Fulfillment';
import { buildReadyFulfillment, makeRepo, makeUnitOfWork, makeOutbox, makeEventBus } from './assignment-uc-fixtures';

function pickedUp(riderId = 'rider-1'): Fulfillment {
  const f = buildReadyFulfillment();
  f.offerToRider(riderId, new Date(Date.now() + 60_000));
  f.acceptByRider(riderId);
  f.confirmPickup(riderId);
  f.pullDomainEvents();
  return f;
}

describe('StartDelivery', () => {
  it('starts delivery by the assigned rider, appends OutForDelivery, publishes', async () => {
    const f = pickedUp('rider-1');
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const outbox = makeOutbox();
    const bus = makeEventBus();
    const uc = new StartDelivery(repo, makeUnitOfWork(), outbox, bus);

    const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: 'rider-1' });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().status).toBe(FULFILLMENT_STATUS.OUT_FOR_DELIVERY);
    expect(repo.update).toHaveBeenCalledTimes(1);
    const events = outbox.append.mock.calls[0][0];
    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe('OutForDelivery');
    expect(bus.publishAll).toHaveBeenCalledTimes(1);
  });

  it('fails before pickup (no persistence)', async () => {
    const f = buildReadyFulfillment();
    f.offerToRider('rider-1', new Date(Date.now() + 60_000));
    f.acceptByRider('rider-1');
    f.pullDomainEvents();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const outbox = makeOutbox();
    const uc = new StartDelivery(repo, makeUnitOfWork(), outbox, makeEventBus());

    const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: 'rider-1' });

    expect(result.isFailure).toBe(true);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('returns NotFoundError for an unknown fulfillment', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new StartDelivery(repo, makeUnitOfWork(), makeOutbox(), makeEventBus());

    const result = await uc.execute({ fulfillmentId: 'nope', riderId: 'r' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });
});
