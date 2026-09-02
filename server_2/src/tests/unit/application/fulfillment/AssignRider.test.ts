import { AssignRider } from '../../../../application/fulfillment/use-cases/AssignRider';
import { ConflictError } from '../../../../domain/shared/errors/ConflictError';
import { RIDER_ASSIGNMENT_STATUS } from '../../../../domain/fulfillment/enums/rider-assignment-status.enum';
import {
  buildReadyFulfillment,
  makeRepo,
  makeUnitOfWork,
  makeEventBus,
  makeAssignmentService,
} from './assignment-uc-fixtures';

const TTL = 60;

describe('AssignRider (admin manual)', () => {
  it('offers to the explicitly-named rider without consulting the service', async () => {
    const f = buildReadyFulfillment();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const service = makeAssignmentService(null); // would return null if consulted
    const bus = makeEventBus();
    const uc = new AssignRider(repo, service, makeUnitOfWork(), bus, TTL);

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
    const uc = new AssignRider(repo, service, makeUnitOfWork(), makeEventBus(), TTL);

    const result = await uc.execute({ fulfillmentId: f.id.toString() });

    expect(service.pickNextRider).toHaveBeenCalledTimes(1);
    expect(result.getValue().currentAssignment?.riderId).toBe('rider-auto');
  });

  it('fails with ConflictError when no riderId and the service finds nobody', async () => {
    const f = buildReadyFulfillment();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const uc = new AssignRider(repo, makeAssignmentService(null), makeUnitOfWork(), makeEventBus(), TTL);

    const result = await uc.execute({ fulfillmentId: f.id.toString() });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ConflictError);
    expect(repo.update).not.toHaveBeenCalled();
  });
});
