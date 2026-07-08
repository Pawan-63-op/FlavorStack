import { Entity } from '../../shared/Entity';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { UniqueEntityId } from '../../shared/UniqueEntityId';
import { ValidationError } from '../../shared/errors/ValidationError';

import { RiderAssignmentStatus } from '../value-objects/RiderAssignmentStatus';
import { RIDER_ASSIGNMENT_STATUS } from '../enums/rider-assignment-status.enum';

export interface RiderAssignmentProps {
  riderId: string;
  status: RiderAssignmentStatus;
  attempt: number;
  offeredAt: Date;
  acceptedAt: Date | null;
  respondedAt: Date | null;
  expiresAt: Date;
}

export interface OfferRiderAssignmentInput {
  riderId: string;
  attempt: number;
  expiresAt: Date;
  offeredAt?: Date;
  id?: UniqueEntityId;
}

export class RiderAssignment extends Entity<RiderAssignmentProps> {
  private constructor(props: RiderAssignmentProps, id?: UniqueEntityId) {
    super(props, id);
  }

  get riderId(): string { return this.props.riderId; }
  get status(): RiderAssignmentStatus { return this.props.status; }
  get attempt(): number { return this.props.attempt; }
  get offeredAt(): Date { return this.props.offeredAt; }
  get acceptedAt(): Date | null { return this.props.acceptedAt; }
  get respondedAt(): Date | null { return this.props.respondedAt; }
  get expiresAt(): Date { return this.props.expiresAt; }

  /** OFFERED or ACCEPTED — occupies the fulfillment's single active-assignment slot. */
  public isActive(): boolean {
    return this.props.status.isActive();
  }

  public isExpired(now: Date = new Date()): boolean {
    return now.getTime() >= this.props.expiresAt.getTime();
  }

  /** Factory: a fresh OFFERED assignment for one rider, with a TTL. Raises no events itself. */
  public static offer(input: OfferRiderAssignmentInput): Result<RiderAssignment> {
    const riderIdCheck = Guard.againstEmptyString(input.riderId, 'RiderId');
    if (riderIdCheck.isFailure) return Result.fail<RiderAssignment>(riderIdCheck.getError());

    if (!Number.isInteger(input.attempt) || input.attempt < 1) {
      return Result.fail<RiderAssignment>(new ValidationError('RiderAssignment attempt must be a positive integer'));
    }

    if (!(input.expiresAt instanceof Date) || isNaN(input.expiresAt.getTime())) {
      return Result.fail<RiderAssignment>(new ValidationError('RiderAssignment expiresAt must be a valid Date'));
    }

    const offeredAt = input.offeredAt ?? new Date();
    if (input.expiresAt.getTime() <= offeredAt.getTime()) {
      return Result.fail<RiderAssignment>(new ValidationError('RiderAssignment expiresAt must be after offeredAt'));
    }

    return Result.ok<RiderAssignment>(
      new RiderAssignment(
        {
          riderId: input.riderId,
          status: RiderAssignmentStatus.offered(),
          attempt: input.attempt,
          offeredAt,
          acceptedAt: null,
          respondedAt: null,
          expiresAt: input.expiresAt,
        },
        input.id
      )
    );
  }

  /** Offered rider accepts before the TTL lapses. OFFERED → ACCEPTED. */
  public accept(now: Date = new Date()): Result<void> {
    if (this.isExpired(now)) {
      return Result.fail<void>(new ValidationError('Rider assignment offer has expired'));
    }

    const transition = this.props.status.transitionTo(RIDER_ASSIGNMENT_STATUS.ACCEPTED);
    if (transition.isFailure) return Result.fail<void>(transition.getError());

    this.props.status = transition.getValue();
    this.props.acceptedAt = now;
    this.props.respondedAt = now;
    return Result.ok<void>(undefined);
  }

  /** Offered rider declines the offer. OFFERED → REJECTED (terminal for this attempt). */
  public reject(now: Date = new Date()): Result<void> {
    const transition = this.props.status.transitionTo(RIDER_ASSIGNMENT_STATUS.REJECTED);
    if (transition.isFailure) return Result.fail<void>(transition.getError());

    this.props.status = transition.getValue();
    this.props.respondedAt = now;
    return Result.ok<void>(undefined);
  }

  /**
   * Phase 5B: the offer TTL lapsed without an accept. OFFERED → EXPIRED (terminal for this attempt).
   * Driven by the assignment-timeout job; the new attempt is a fresh RiderAssignment.
   */
  public expire(now: Date = new Date()): Result<void> {
    const transition = this.props.status.transitionTo(RIDER_ASSIGNMENT_STATUS.EXPIRED);
    if (transition.isFailure) return Result.fail<void>(transition.getError());

    this.props.status = transition.getValue();
    this.props.respondedAt = now;
    return Result.ok<void>(undefined);
  }

  /**
   * Phase 5B: an ACCEPTED rider is dropped and the delivery handed to a new rider. ACCEPTED →
   * REASSIGNED (terminal for this attempt). Used inside Fulfillment.reassign().
   */
  public reassign(now: Date = new Date()): Result<void> {
    const transition = this.props.status.transitionTo(RIDER_ASSIGNMENT_STATUS.REASSIGNED);
    if (transition.isFailure) return Result.fail<void>(transition.getError());

    this.props.status = transition.getValue();
    this.props.respondedAt = now;
    return Result.ok<void>(undefined);
  }

  /** Rehydrate a persisted assignment (mapper entry point). */
  public static reconstitute(props: RiderAssignmentProps, id: UniqueEntityId): RiderAssignment {
    return new RiderAssignment(props, id);
  }
}
