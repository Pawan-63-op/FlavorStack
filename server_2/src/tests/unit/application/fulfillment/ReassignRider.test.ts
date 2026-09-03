import { ReassignRider } from '../../../../application/fulfillment/use-cases/ReassignRider';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ConflictError } from '../../../../domain/shared/errors/ConflictError';
import { ValidationError } from '../../../../domain/shared/errors/ValidationError';
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
const MAX_ATTEMPTS = 3;

function buildAssigned(): Fulfillment {
  const f = buildReadyFulfillment();
  f.offerToRider(RIDER_1, new Date(Date.now() + 60_000));
  f.acceptByRider(RIDER_1);
  f.pullDomainEvents();
  return f;
}

function makeUc(
  repo = makeRepo(),
  service = makeAssignmentService(RIDER_2)
): { uc: ReassignRider; bus: ReturnType<typeof makeEventBus> } {
  const bus = makeEventBus();
  const uc = new ReassignRider(repo, service, makeUnitOfWork(), bus, TTL, MAX_ATTEMPTS);
  return { uc, bus };
}

/** A fulfillment with a live, unanswered OFFER to RIDER_1. */
function buildOffered(): Fulfillment {
  const f = buildReadyFulfillment();
  f.offerToRider(RIDER_1, new Date(Date.now() + 60_000));
  f.pullDomainEvents();
  return f;
}

describe('ReassignRider', () => {
  it('hands an ACCEPTED delivery to the admin-named rider, emitting RiderReassigned + RiderAssigned', async () => {
    const f = buildAssigned();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const { uc, bus } = makeUc(repo, makeAssignmentService(null));

    const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: RIDER_2 });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().currentAssignment).toEqual(
      expect.objectContaining({ riderId: RIDER_2, status: RIDER_ASSIGNMENT_STATUS.ACCEPTED, attempt: 2 })
    );
    // Both, deliberately: RiderReassigned is the audit record, RiderAssigned is what reaches the
    // customer (OnRiderAssigned is the only notifier, and it subscribes to RiderAssigned alone).
    const events = bus.publishAll.mock.calls[0][0];
    expect(events.map((e: { eventName: string }) => e.eventName)).toEqual([
      'RiderReassigned',
      'RiderAssigned',
    ]);
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

  it('makes a plain fresh offer when there is no current assignment', async () => {
    const f = buildReadyFulfillment(); // UNASSIGNED, no current assignment
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const { uc, bus } = makeUc(repo, makeAssignmentService(RIDER_1));

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

  /**
   * The Phase 10.4 fix. An OFFERED (unanswered) assignment used to be delegated to `AssignRider`,
   * whose `offerToRider` then failed with `ConflictError('An active rider assignment already
   * exists')` — so an admin simply could not pull back an offer nobody had answered.
   */
  describe('on an OFFERED (unanswered) fulfillment', () => {
    it('withdraws the live offer and re-offers to the new rider', async () => {
      const f = buildOffered();
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
      const { uc, bus } = makeUc(repo, makeAssignmentService(RIDER_2));

      const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: RIDER_2 });

      expect(result.isSuccess).toBe(true);
      expect(result.getValue().currentAssignment).toEqual(
        expect.objectContaining({ riderId: RIDER_2, status: RIDER_ASSIGNMENT_STATUS.OFFERED })
      );
      // The withdrawn attempt is kept as history, exactly as an expiry would be.
      expect(f.assignmentHistory).toHaveLength(1);
      expect(f.assignmentHistory[0].riderId).toBe(RIDER_1);
      expect(f.assignmentHistory[0].status.value).toBe(RIDER_ASSIGNMENT_STATUS.EXPIRED);
      expect(bus.publishAll.mock.calls[0][0][0].eventName).toBe('RiderOffered');
      expect(repo.update).toHaveBeenCalledTimes(1);
    });

    it('picks the next candidate itself, never re-offering to the rider it just withdrew from', async () => {
      const f = buildOffered();
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
  });

  it('rejects an admin-named rider who is not an assignable driver, leaving the aggregate alone', async () => {
    const f = buildAssigned();
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const { uc, bus } = makeUc(repo, makeAssignmentService(RIDER_2, false));

    const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: 'cust-9' });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ValidationError);
    expect(f.currentAssignment!.riderId).toBe(RIDER_1);
    expect(repo.update).not.toHaveBeenCalled();
    expect(bus.publishAll).not.toHaveBeenCalled();
  });

  it('refuses to loop past the attempt cap the automatic path respects', async () => {
    const f = buildReadyFulfillment();
    for (const rider of ['r1', 'r2', 'r3']) {
      f.offerToRider(rider, new Date(Date.now() + 60_000));
      f.rejectByRider(rider);
    }
    f.pullDomainEvents();

    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(f) });
    const { uc } = makeUc(repo, makeAssignmentService(RIDER_2));

    const result = await uc.execute({ fulfillmentId: f.id.toString(), riderId: RIDER_2 });

    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ConflictError);
    expect((result.getError() as ConflictError).message).toBe('assignment_attempts_exhausted');
    expect(repo.update).not.toHaveBeenCalled();
  });
});
