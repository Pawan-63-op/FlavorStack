import { AssignRider } from '../../../../application/fulfillment/use-cases/AssignRider';
import { ConflictError } from '../../../../domain/shared/errors/ConflictError';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';
import { RIDER_ASSIGNMENT_STATUS } from '../../../../domain/fulfillment/enums/rider-assignment-status.enum';
import {
  buildReadyFulfillment,
  makeRepo,
  makeUnitOfWork,
  makeEventBus,
  makeAssignmentService,
} from './assignment-uc-fixtures';

const TTL = 60;
const MAX_ATTEMPTS = 3;

describe('AssignRider (admin manual)', () => {
  it('offers to the explicitly-named rider without consulting the service for a candidate', async () => {
    const f = buildReadyFulfillment();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const service = makeAssignmentService(null); // would return null if consulted
    const bus = makeEventBus();
    const uc = new AssignRider(repo, service, makeUnitOfWork(), bus, TTL, MAX_ATTEMPTS);

    const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: 'rider-admin' });

    expect(result.isSuccess).toBe(true);
    expect(service.pickNextRider).not.toHaveBeenCalled();
    expect(result.getValue().currentAssignment).toMatchObject({
      riderId: 'rider-admin',
      status: RIDER_ASSIGNMENT_STATUS.OFFERED,
    });
    expect(bus.publishAll.mock.calls[0][0][0].eventName).toBe('RiderOffered');
  });

  it('falls back to the service when no riderId is supplied', async () => {
    const f = buildReadyFulfillment();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const service = makeAssignmentService('rider-auto');
    const uc = new AssignRider(repo, service, makeUnitOfWork(), makeEventBus(), TTL, MAX_ATTEMPTS);

    const result = await uc.execute({ fulfillmentId: f.id.toString() });

    expect(service.pickNextRider).toHaveBeenCalledTimes(1);
    expect(result.getValue().currentAssignment?.riderId).toBe('rider-auto');
  });

  it('fails with ConflictError when no riderId and the service finds nobody', async () => {
    const f = buildReadyFulfillment();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const uc = new AssignRider(repo, makeAssignmentService(null), makeUnitOfWork(), makeEventBus(), TTL, MAX_ATTEMPTS);

    const result = await uc.execute({ fulfillmentId: f.id.toString() });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ConflictError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('rejects an explicitly-named rider who is not an assignable driver', async () => {
    const f = buildReadyFulfillment();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const service = makeAssignmentService('rider-auto', false); // isRiderAssignable → false
    const bus = makeEventBus();
    const uc = new AssignRider(repo, service, makeUnitOfWork(), bus, TTL, MAX_ATTEMPTS);

    // Before Phase 10.4 this offered a delivery to a customer's id without a murmur.
    const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: 'cust-9' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
    expect((result.getError() as ValidationError).message).toBe('rider_not_available');
    expect(repo.update).not.toHaveBeenCalled();
    expect(bus.publishAll).not.toHaveBeenCalled();
  });

  it('refuses once the attempt cap is reached, however the offer was triggered', async () => {
    const f = buildReadyFulfillment();
    // Three exhausted attempts already in history.
    for (const rider of ['r1', 'r2', 'r3']) {
      f.offerToRider(rider, new Date(Date.now() + 60_000));
      f.rejectByRider(rider);
    }
    f.pullDomainEvents();

    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const service = makeAssignmentService('rider-4');
    const uc = new AssignRider(repo, service, makeUnitOfWork(), makeEventBus(), TTL, MAX_ATTEMPTS);

    const result = await uc.execute({ fulfillmentId: f.id.toString() });

    expect(result.isFailure).toBe(true);
    expect((result.getError() as ConflictError).message).toBe('assignment_attempts_exhausted');
    expect(repo.update).not.toHaveBeenCalled();
  });
});
