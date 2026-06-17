// Per-attempt rider-assignment state-machine VO (fulfillment_module.md §4.2). Mirrors
// FulfillmentStatus / catalog RestaurantStatus.vo.ts: private ctor + static create(),
// canTransitionTo(), transitionTo(): Result<VO>. The full transition table is encoded; Phase 3A
// drives OFFERED → ACCEPTED/REJECTED. EXPIRED/CANCELLED/REASSIGNED are realized in later phases.
import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { ValidationError } from '../../shared/errors/ValidationError';
import { RIDER_ASSIGNMENT_STATUS, RiderAssignmentStatusValue } from '../enums/rider-assignment-status.enum';

interface RiderAssignmentStatusProps {
  value: RiderAssignmentStatusValue;
}

const ALLOWED_TRANSITIONS: Record<RiderAssignmentStatusValue, RiderAssignmentStatusValue[]> = {
  [RIDER_ASSIGNMENT_STATUS.OFFERED]: [
    RIDER_ASSIGNMENT_STATUS.ACCEPTED,
    RIDER_ASSIGNMENT_STATUS.REJECTED,
    RIDER_ASSIGNMENT_STATUS.EXPIRED,
  ],
  [RIDER_ASSIGNMENT_STATUS.ACCEPTED]: [
    RIDER_ASSIGNMENT_STATUS.CANCELLED,
    RIDER_ASSIGNMENT_STATUS.REASSIGNED,
  ],
  [RIDER_ASSIGNMENT_STATUS.REJECTED]: [],
  [RIDER_ASSIGNMENT_STATUS.EXPIRED]: [],
  [RIDER_ASSIGNMENT_STATUS.CANCELLED]: [],
  [RIDER_ASSIGNMENT_STATUS.REASSIGNED]: [],
};

// OFFERED and ACCEPTED are the only non-terminal ("active") states — at most one such
// assignment may exist per fulfillment at a time (fulfillment_module.md §4.2 invariant).
const ACTIVE_STATES: RiderAssignmentStatusValue[] = [
  RIDER_ASSIGNMENT_STATUS.OFFERED,
  RIDER_ASSIGNMENT_STATUS.ACCEPTED,
];

export class RiderAssignmentStatus extends ValueObject<RiderAssignmentStatusProps> {
  private constructor(props: RiderAssignmentStatusProps) {
    super(props);
  }

  get value(): RiderAssignmentStatusValue {
    return this.props.value;
  }

  public static create(value: RiderAssignmentStatusValue): Result<RiderAssignmentStatus> {
    if (!Object.values(RIDER_ASSIGNMENT_STATUS).includes(value)) {
      return Result.fail<RiderAssignmentStatus>(new ValidationError(`Invalid rider assignment status: ${value}`));
    }
    return Result.ok<RiderAssignmentStatus>(new RiderAssignmentStatus({ value }));
  }

  /** The initial state when a rider assignment is first offered. */
  public static offered(): RiderAssignmentStatus {
    return new RiderAssignmentStatus({ value: RIDER_ASSIGNMENT_STATUS.OFFERED });
  }

  public isTerminal(): boolean {
    return ALLOWED_TRANSITIONS[this.props.value].length === 0;
  }

  /** OFFERED or ACCEPTED — a live attempt occupying the fulfillment's single active-assignment slot. */
  public isActive(): boolean {
    return ACTIVE_STATES.includes(this.props.value);
  }

  public canTransitionTo(target: RiderAssignmentStatusValue): boolean {
    return ALLOWED_TRANSITIONS[this.props.value].includes(target);
  }

  public transitionTo(target: RiderAssignmentStatusValue): Result<RiderAssignmentStatus> {
    if (!this.canTransitionTo(target)) {
      return Result.fail<RiderAssignmentStatus>(
        new ValidationError(`Cannot transition rider assignment status from ${this.props.value} to ${target}`)
      );
    }
    return RiderAssignmentStatus.create(target);
  }
}
