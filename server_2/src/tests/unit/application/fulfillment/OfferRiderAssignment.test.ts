import { OfferRiderAssignment } from '../../../../application/fulfillment/use-cases/OfferRiderAssignment';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ConflictError } from '../../../../domain/shared/errors/ConflictError';
import { RIDER_ASSIGNMENT_STATUS } from '../../../../domain/fulfillment/enums/rider-assignment-status.enum';
import {
  buildReadyFulfillment,
  makeRepo,
  makeUnitOfWork,
  makeOutbox,
  makeEventBus,
  makeAssignmentService,
} from './assignment-uc-fixtures';

const TTL = 60;

describe('OfferRiderAssignment', () => {
  it('picks a rider via the service, offers, appends RiderOffered, publishes', async () => {
    const f = buildReadyFulfillment();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const service = makeAssignmentService('rider-1');
    const outbox = makeOutbox();
    const bus = makeEventBus();
    const uc = new OfferRiderAssignment(repo, service, makeUnitOfWork(), outbox, bus, TTL);

    const result = await uc.execute({ fulfillmentId: f.id.toString() });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().currentAssignment).toMatchObject({
      riderId: 'rider-1',
      status: RIDER_ASSIGNMENT_STATUS.OFFERED,
      attempt: 1,
    });
    expect(repo.update).toHaveBeenCalledTimes(1);
    const events = outbox.append.mock.calls[0][0];
    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe('RiderOffered');
    expect(bus.publishAll).toHaveBeenCalledTimes(1);
  });

  it('excludes already-tried riders when asking the service', async () => {
    const f = buildReadyFulfillment();
    f.offerToRider('rider-1', new Date(Date.now() + 60_000));
    f.rejectByRider('rider-1');
    f.pullDomainEvents();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const service = makeAssignmentService('rider-2');
    const uc = new OfferRiderAssignment(repo, service, makeUnitOfWork(), makeOutbox(), makeEventBus(), TTL);

    await uc.execute({ fulfillmentId: f.id.toString() });

    expect(service.pickNextRider).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: 'rest-1', excludeRiderIds: ['rider-1'] })
    );
  });

  it('fails with ConflictError when no rider is available (no persistence)', async () => {
    const f = buildReadyFulfillment();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const outbox = makeOutbox();
    const uc = new OfferRiderAssignment(repo, makeAssignmentService(null), makeUnitOfWork(), outbox, makeEventBus(), TTL);

    const result = await uc.execute({ fulfillmentId: f.id.toString() });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ConflictError);
    expect(repo.update).not.toHaveBeenCalled();
    expect(outbox.append).not.toHaveBeenCalled();
  });

  it('returns NotFoundError for an unknown fulfillment', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new OfferRiderAssignment(repo, makeAssignmentService('r'), makeUnitOfWork(), makeOutbox(), makeEventBus(), TTL);

    const result = await uc.execute({ fulfillmentId: 'nope' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });

  it('fails (one active assignment) when an offer is already live', async () => {
    const f = buildReadyFulfillment();
    f.offerToRider('rider-1', new Date(Date.now() + 60_000));
    f.pullDomainEvents();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const outbox = makeOutbox();
    const uc = new OfferRiderAssignment(repo, makeAssignmentService('rider-2'), makeUnitOfWork(), outbox, makeEventBus(), TTL);

    const result = await uc.execute({ fulfillmentId: f.id.toString() });

    expect(result.isFailure).toBe(true);
    expect(repo.update).not.toHaveBeenCalled();
  });
});
