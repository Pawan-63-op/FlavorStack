import { RiderAssignmentStatus } from '../../../../../domain/fulfillment/value-objects/RiderAssignmentStatus';
import { RIDER_ASSIGNMENT_STATUS } from '../../../../../domain/fulfillment/enums/rider-assignment-status.enum';

describe('RiderAssignmentStatus', () => {
  it('starts OFFERED via the offered() factory', () => {
    expect(RiderAssignmentStatus.offered().value).toBe(RIDER_ASSIGNMENT_STATUS.OFFERED);
  });

  it('rejects an invalid status value', () => {
    const result = RiderAssignmentStatus.create('NONSENSE' as never);
    expect(result.isFailure).toBe(true);
  });

  describe('transitions from OFFERED', () => {
    it.each([
      RIDER_ASSIGNMENT_STATUS.ACCEPTED,
      RIDER_ASSIGNMENT_STATUS.REJECTED,
      RIDER_ASSIGNMENT_STATUS.EXPIRED,
    ])('allows OFFERED → %s', (target) => {
      const offered = RiderAssignmentStatus.offered();
      expect(offered.canTransitionTo(target)).toBe(true);
      expect(offered.transitionTo(target).getValue().value).toBe(target);
    });

    it('rejects OFFERED → CANCELLED', () => {
      const result = RiderAssignmentStatus.offered().transitionTo(RIDER_ASSIGNMENT_STATUS.CANCELLED);
      expect(result.isFailure).toBe(true);
    });
  });

  describe('transitions from ACCEPTED', () => {
    it.each([RIDER_ASSIGNMENT_STATUS.CANCELLED, RIDER_ASSIGNMENT_STATUS.REASSIGNED])(
      'allows ACCEPTED → %s',
      (target) => {
        const accepted = RiderAssignmentStatus.create(RIDER_ASSIGNMENT_STATUS.ACCEPTED).getValue();
        expect(accepted.canTransitionTo(target)).toBe(true);
      }
    );

    it('rejects ACCEPTED → OFFERED', () => {
      const accepted = RiderAssignmentStatus.create(RIDER_ASSIGNMENT_STATUS.ACCEPTED).getValue();
      expect(accepted.transitionTo(RIDER_ASSIGNMENT_STATUS.OFFERED).isFailure).toBe(true);
    });
  });

  describe('terminal & active classification', () => {
    it.each([
      RIDER_ASSIGNMENT_STATUS.REJECTED,
      RIDER_ASSIGNMENT_STATUS.EXPIRED,
      RIDER_ASSIGNMENT_STATUS.CANCELLED,
      RIDER_ASSIGNMENT_STATUS.REASSIGNED,
    ])('%s is terminal and not active', (value) => {
      const status = RiderAssignmentStatus.create(value).getValue();
      expect(status.isTerminal()).toBe(true);
      expect(status.isActive()).toBe(false);
    });

    it.each([RIDER_ASSIGNMENT_STATUS.OFFERED, RIDER_ASSIGNMENT_STATUS.ACCEPTED])(
      '%s is active and not terminal',
      (value) => {
        const status = RiderAssignmentStatus.create(value).getValue();
        expect(status.isActive()).toBe(true);
        expect(status.isTerminal()).toBe(false);
      }
    );
  });
});
