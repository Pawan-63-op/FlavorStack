import { AcceptDelivery } from '../../../../application/fulfillment/use-cases/AcceptDelivery';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { RIDER_ASSIGNMENT_STATUS } from '../../../../domain/fulfillment/enums/rider-assignment-status.enum';
import {
  buildReadyFulfillment,
  makeRepo,
  makeUnitOfWork,
  makeOutbox,
  makeEventBus,
} from './assignment-uc-fixtures';

function offered(riderId = 'rider-1') {
  const f = buildReadyFulfillment();
  f.offerToRider(riderId, new Date(Date.now() + 60_000));
  f.pullDomainEvents();
  return f;
}

describe('AcceptDelivery', () => {
  it('accepts by the offered rider, appends RiderAssigned, publishes', async () => {
    const f = offered('rider-1');
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const outbox = makeOutbox();
    const bus = makeEventBus();
    const uc = new AcceptDelivery(repo, makeUnitOfWork(), outbox, bus);

    const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: 'rider-1' });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().currentAssignment?.status).toBe(RIDER_ASSIGNMENT_STATUS.ACCEPTED);
    expect(repo.update).toHaveBeenCalledTimes(1);
    const events = outbox.append.mock.calls[0][0];
    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe('RiderAssigned');
    expect(bus.publishAll).toHaveBeenCalledTimes(1);
  });

  it('forbids acceptance by a different rider (no persistence)', async () => {
    const f = offered('rider-1');
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const outbox = makeOutbox();
    const uc = new AcceptDelivery(repo, makeUnitOfWork(), outbox, makeEventBus());

    const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: 'rider-2' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
    expect(repo.update).not.toHaveBeenCalled();
    expect(outbox.append).not.toHaveBeenCalled();
  });

  it('returns NotFoundError for an unknown fulfillment', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new AcceptDelivery(repo, makeUnitOfWork(), makeOutbox(), makeEventBus());

    const result = await uc.execute({ fulfillmentId: 'nope', riderId: 'r' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });
});
