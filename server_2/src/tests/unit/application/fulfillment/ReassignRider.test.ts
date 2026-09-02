import { ReassignRider } from '../../../../application/fulfillment/use-cases/ReassignRider';
import { AssignRider } from '../../../../application/fulfillment/use-cases/AssignRider';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { Fulfillment } from '../../../../domain/fulfillment/entities/Fulfillment';
import { RIDER_ASSIGNMENT_STATUS } from '../../../../domain/fulfillment/enums/rider-assignment-status.enum';
import {
  buildReadyFulfillment,
  makeRepo,
  makeUnitOfWork,
  makeEventBus,
  makeAssignmentService,
} from './assignment-uc-fixtures';

const RIDER_1 = 'rider-1';
const RIDER_2 = 'rider-2';
const TTL = 60;

function buildAssigned(): Fulfillment {
  const f = buildReadyFulfillment();
  f.offerToRider(RIDER_1, new Date(Date.now() + 60_000));
  f.acceptByRider(RIDER_1);
  f.pullDomainEvents();
  return f;
}

function makeUc(
  repo = makeRepo(),
  service = makeAssignmentService(RIDER_2),
  assignRider?: AssignRider
): { uc: ReassignRider; bus: ReturnType<typeof makeEventBus> } {
  const bus = makeEventBus();
  const ar = assignRider ?? new AssignRider(repo, service, makeUnitOfWork(), bus, TTL);
  const uc = new ReassignRider(repo, service, makeUnitOfWork(), bus, TTL, ar);
  return { uc, bus };
}

describe('ReassignRider', () => {
  it('hands an ACCEPTED delivery to the admin-named rider, emitting RiderReassigned', async () => {
    const f = buildAssigned();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const { uc, bus } = makeUc(repo, makeAssignmentService(null));

    const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: RIDER_2 });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().currentAssignment).toEqual(
      expect.objectContaining({ riderId: RIDER_2, status: RIDER_ASSIGNMENT_STATUS.ACCEPTED, attempt: 2 })
    );
    const events = bus.publishAll.mock.calls[0][0];
    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe('RiderReassigned');
  });

  it('picks the next candidate from the service when no rider is named', async () => {
    const f = buildAssigned();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const service = makeAssignmentService(RIDER_2);
    const { uc } = makeUc(repo, service);

    const result = await uc.execute({ fulfillmentId: f.id.toString() });

    expect(result.isSuccess).toBe(true);
    expect(service.pickNextRider).toHaveBeenCalledWith(
      expect.objectContaining({ excludeRiderIds: expect.arrayContaining([RIDER_1]) })
    );
    expect(result.getValue().currentAssignment!.riderId).toBe(RIDER_2);
  });

  it('delegates to AssignRider (fresh offer) when there is no accepted rider', async () => {
    const f = buildReadyFulfillment(); // UNASSIGNED, no current assignment
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const service = makeAssignmentService(RIDER_1);
    const bus = makeEventBus();
    const assignRider = new AssignRider(repo, service, makeUnitOfWork(), bus, TTL);
    const uc = new ReassignRider(repo, service, makeUnitOfWork(), bus, TTL, assignRider);

    const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: RIDER_1 });

    expect(result.isSuccess).toBe(true);
    const events = bus.publishAll.mock.calls[0][0];
    expect(events[0].eventName).toBe('RiderOffered');
    expect(result.getValue().currentAssignment).toEqual(
      expect.objectContaining({ riderId: RIDER_1, status: RIDER_ASSIGNMENT_STATUS.OFFERED })
    );
  });

  it('returns NotFoundError for an unknown fulfillment', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const { uc } = makeUc(repo);
    const result = await uc.execute({ fulfillmentId: 'nope' });
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
  });
});
