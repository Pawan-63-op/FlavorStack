// Fulfillment — THE aggregate root for one order's post-checkout journey (fulfillment_module.md §2.1).
//
// Phase 1: created from OrderRequested into CREATED state, raising FulfillmentCreated.
// Phase 2: restaurant-driven prep transitions — startPreparation() → PREPARING,
//          markReadyForPickup() → READY_FOR_PICKUP. Version is incremented per mutation;
//          _persistedVersion captures the version at load time for optimistic-concurrency checks.
//
// Mutations happen ONLY through aggregate methods; each raises its domain event via addDomainEvent().
// Ownership is enforced inside each method: the calling restaurantId must match this.restaurantId.
import { AggregateRoot } from '../../shared/AggregateRoot';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { UniqueEntityId } from '../../shared/UniqueEntityId';
import { ValidationError } from '../../shared/errors/ValidationError';
import { ForbiddenError } from '../../shared/errors/ForbiddenError';
import { ConflictError } from '../../shared/errors/ConflictError';
import { Money } from '../../shared/Money';

import { FulfillmentStatus } from '../value-objects/FulfillmentStatus';
import { DeliveryStatus } from '../value-objects/DeliveryStatus';
import { FulfillmentLine } from '../value-objects/FulfillmentLine';
import { DeliveryAddress } from '../value-objects/DeliveryAddress';
import { CancellationInfo } from '../value-objects/CancellationInfo';
import { RiderAssignment } from './RiderAssignment';
import { FULFILLMENT_STATUS } from '../enums/fulfillment-status.enum';
import { DELIVERY_STATUS } from '../enums/delivery-status.enum';
import { RIDER_ASSIGNMENT_STATUS } from '../enums/rider-assignment-status.enum';
import { CANCELLED_BY, CancelledByValue } from '../enums/cancelled-by.enum';
import { FAILURE_REASON, FailureReasonValue } from '../enums/failure-reason.enum';
import { FulfillmentCreated } from '../events/FulfillmentCreated';
import { PreparationStarted } from '../events/PreparationStarted';
import { ReadyForPickup } from '../events/ReadyForPickup';
import { RiderOffered } from '../events/RiderOffered';
import { RiderAssigned } from '../events/RiderAssigned';
import { PickupConfirmed } from '../events/PickupConfirmed';
import { OutForDelivery } from '../events/OutForDelivery';
import { DeliveryCompleted } from '../events/DeliveryCompleted';
import { FulfillmentCancelled } from '../events/FulfillmentCancelled';
import { DeliveryFailed } from '../events/DeliveryFailed';
import { RiderReassigned } from '../events/RiderReassigned';
import { RiderAssignmentExpired } from '../events/RiderAssignmentExpired';

export interface FulfillmentProps {
  orderRequestId: string;
  customerId: string;
  restaurantId: string;
  lines: FulfillmentLine[];
  deliveryAddress: DeliveryAddress;
  pricingTotal: Money;
  fulfillmentStatus: FulfillmentStatus;
  deliveryStatus: DeliveryStatus;
  currentAssignment: RiderAssignment | null;
  assignmentHistory: RiderAssignment[];
  cancellation?: CancellationInfo | null;
  failureReason?: FailureReasonValue | null;
  prepEstimateMinutes?: number;
  createdAt: Date;
  updatedAt: Date;
  readyAt?: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
  version: number;
}

export interface CreateFulfillmentInput {
  orderRequestId: string;
  customerId: string;
  restaurantId: string;
  lines: FulfillmentLine[];
  deliveryAddress: DeliveryAddress;
  pricingTotal: Money;
  id?: UniqueEntityId;
}

export class Fulfillment extends AggregateRoot<FulfillmentProps> {
  // Version at load time — used by the repository for optimistic-concurrency (cf. Restaurant.persistedVersion).
  private readonly _persistedVersion: number;

  private constructor(props: FulfillmentProps, id?: UniqueEntityId) {
    super(props, id);
    this._persistedVersion = props.version;
  }

  get orderRequestId(): string { return this.props.orderRequestId; }
  get customerId(): string { return this.props.customerId; }
  get restaurantId(): string { return this.props.restaurantId; }
  get lines(): FulfillmentLine[] { return [...this.props.lines]; }
  get deliveryAddress(): DeliveryAddress { return this.props.deliveryAddress; }
  get pricingTotal(): Money { return this.props.pricingTotal; }
  get fulfillmentStatus(): FulfillmentStatus { return this.props.fulfillmentStatus; }
  get deliveryStatus(): DeliveryStatus { return this.props.deliveryStatus; }
  get currentAssignment(): RiderAssignment | null { return this.props.currentAssignment; }
  get assignmentHistory(): RiderAssignment[] { return [...this.props.assignmentHistory]; }
  get cancellation(): CancellationInfo | null { return this.props.cancellation ?? null; }
  get failureReason(): FailureReasonValue | null { return this.props.failureReason ?? null; }
  get prepEstimateMinutes(): number | undefined { return this.props.prepEstimateMinutes; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get readyAt(): Date | undefined { return this.props.readyAt; }
  get pickedUpAt(): Date | undefined { return this.props.pickedUpAt; }
  get deliveredAt(): Date | undefined { return this.props.deliveredAt; }
  get version(): number { return this.props.version; }
  get persistedVersion(): number { return this._persistedVersion; }

  /**
   * Factory: build a CREATED fulfillment from an OrderRequested event.
   * Raises FulfillmentCreated.
   */
  public static createFromOrderRequested(input: CreateFulfillmentInput): Result<Fulfillment> {
    const orderRequestIdCheck = Guard.againstEmptyString(input.orderRequestId, 'OrderRequestId');
    if (orderRequestIdCheck.isFailure) return Result.fail<Fulfillment>(orderRequestIdCheck.getError());

    const customerIdCheck = Guard.againstEmptyString(input.customerId, 'CustomerId');
    if (customerIdCheck.isFailure) return Result.fail<Fulfillment>(customerIdCheck.getError());

    const restaurantIdCheck = Guard.againstEmptyString(input.restaurantId, 'RestaurantId');
    if (restaurantIdCheck.isFailure) return Result.fail<Fulfillment>(restaurantIdCheck.getError());

    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      return Result.fail<Fulfillment>(new ValidationError('Fulfillment must contain at least one line'));
    }

    if (input.lines.some((l) => !(l instanceof FulfillmentLine))) {
      return Result.fail<Fulfillment>(new ValidationError('Fulfillment lines must all be FulfillmentLine VOs'));
    }

    if (!(input.deliveryAddress instanceof DeliveryAddress)) {
      return Result.fail<Fulfillment>(new ValidationError('Fulfillment deliveryAddress must be a valid DeliveryAddress'));
    }

    if (!(input.pricingTotal instanceof Money)) {
      return Result.fail<Fulfillment>(new ValidationError('Fulfillment pricingTotal must be a valid Money'));
    }

    const now = new Date();
    const fulfillment = new Fulfillment(
      {
        orderRequestId: input.orderRequestId,
        customerId: input.customerId,
        restaurantId: input.restaurantId,
        lines: [...input.lines],
        deliveryAddress: input.deliveryAddress,
        pricingTotal: input.pricingTotal,
        fulfillmentStatus: FulfillmentStatus.created(),
        deliveryStatus: DeliveryStatus.unassigned(),
        currentAssignment: null,
        assignmentHistory: [],
        cancellation: null,
        failureReason: null,
        createdAt: now,
        updatedAt: now,
        version: 0,
      },
      input.id
    );

    fulfillment.addDomainEvent(
      new FulfillmentCreated({
        fulfillmentId: fulfillment.id.toString(),
        orderRequestId: fulfillment.props.orderRequestId,
        customerId: fulfillment.props.customerId,
        restaurantId: fulfillment.props.restaurantId,
        total: {
          amount: fulfillment.props.pricingTotal.amount,
          currency: fulfillment.props.pricingTotal.currency,
        },
      })
    );

    return Result.ok<Fulfillment>(fulfillment);
  }

  /** Phase 2: Restaurant starts preparation. CREATED → PREPARING. */
  public startPreparation(actorRestaurantId: string, prepEstimateMinutes?: number): Result<void> {
    if (actorRestaurantId !== this.props.restaurantId) {
      return Result.fail<void>(new ForbiddenError('Only the owning restaurant can start preparation'));
    }

    const transition = this.props.fulfillmentStatus.transitionTo(FULFILLMENT_STATUS.PREPARING);
    if (transition.isFailure) return Result.fail<void>(transition.getError());

    this.props.fulfillmentStatus = transition.getValue();
    this.props.prepEstimateMinutes = prepEstimateMinutes;
    this.props.updatedAt = new Date();
    this.props.version += 1;

    this.addDomainEvent(
      new PreparationStarted({
        fulfillmentId: this.id.toString(),
        restaurantId: this.props.restaurantId,
        prepEstimateMinutes,
      })
    );

    return Result.ok<void>(undefined);
  }

  /** Phase 2: Restaurant marks food ready. PREPARING → READY_FOR_PICKUP. */
  public markReadyForPickup(actorRestaurantId: string): Result<void> {
    if (actorRestaurantId !== this.props.restaurantId) {
      return Result.fail<void>(new ForbiddenError('Only the owning restaurant can mark ready for pickup'));
    }

    const transition = this.props.fulfillmentStatus.transitionTo(FULFILLMENT_STATUS.READY_FOR_PICKUP);
    if (transition.isFailure) return Result.fail<void>(transition.getError());

    const readyAt = new Date();
    this.props.fulfillmentStatus = transition.getValue();
    this.props.readyAt = readyAt;
    this.props.updatedAt = new Date();
    this.props.version += 1;

    this.addDomainEvent(
      new ReadyForPickup({
        fulfillmentId: this.id.toString(),
        restaurantId: this.props.restaurantId,
        readyAt,
      })
    );

    return Result.ok<void>(undefined);
  }

  /**
   * Phase 3A: Offer the delivery to a rider with a TTL. Raises RiderOffered.
   *
   * Invariant: at most one ACTIVE assignment (OFFERED/ACCEPTED) at a time. A terminal prior
   * assignment (rejected/expired) is swept into history first so attempt numbering stays correct.
   */
  public offerToRider(riderId: string, expiresAt: Date): Result<void> {
    if (this.props.fulfillmentStatus.isTerminal()) {
      return Result.fail<void>(
        new ValidationError(`Cannot offer a rider on a ${this.props.fulfillmentStatus.value} fulfillment`)
      );
    }

    if (this.props.currentAssignment && this.props.currentAssignment.isActive()) {
      return Result.fail<void>(new ConflictError('An active rider assignment already exists for this fulfillment'));
    }

    // Sweep a leftover terminal assignment into history before opening a new attempt.
    if (this.props.currentAssignment && !this.props.currentAssignment.isActive()) {
      this.props.assignmentHistory.push(this.props.currentAssignment);
      this.props.currentAssignment = null;
    }

    const attempt = this.props.assignmentHistory.length + 1;
    const assignmentResult = RiderAssignment.offer({ riderId, attempt, expiresAt });
    if (assignmentResult.isFailure) return Result.fail<void>(assignmentResult.getError());

    const assignment = assignmentResult.getValue();
    this.props.currentAssignment = assignment;
    this.props.updatedAt = new Date();
    this.props.version += 1;

    this.addDomainEvent(
      new RiderOffered({
        fulfillmentId: this.id.toString(),
        riderId: assignment.riderId,
        attempt: assignment.attempt,
        expiresAt: assignment.expiresAt,
      })
    );

    return Result.ok<void>(undefined);
  }

  /**
   * Phase 3A: The offered rider accepts. OFFERED → ACCEPTED. Raises RiderAssigned.
   * Accept only by the offered rider, and only before the offer's expiresAt.
   */
  public acceptByRider(riderId: string): Result<void> {
    const assignment = this.props.currentAssignment;
    if (!assignment || assignment.status.value !== RIDER_ASSIGNMENT_STATUS.OFFERED) {
      return Result.fail<void>(new ValidationError('No active offer to accept for this fulfillment'));
    }

    if (assignment.riderId !== riderId) {
      return Result.fail<void>(new ForbiddenError('Only the offered rider can accept this delivery'));
    }

    const now = new Date();
    const accepted = assignment.accept(now);
    if (accepted.isFailure) return Result.fail<void>(accepted.getError());

    // Couple the rider leg: an accepted assignment moves the delivery sub-state to ASSIGNED (§3.1).
    const deliveryTransition = this.props.deliveryStatus.transitionTo(DELIVERY_STATUS.ASSIGNED);
    if (deliveryTransition.isFailure) return Result.fail<void>(deliveryTransition.getError());
    this.props.deliveryStatus = deliveryTransition.getValue();

    this.props.updatedAt = now;
    this.props.version += 1;

    this.addDomainEvent(
      new RiderAssigned({
        fulfillmentId: this.id.toString(),
        riderId: assignment.riderId,
        assignedAt: now,
      })
    );

    return Result.ok<void>(undefined);
  }

  /**
   * Phase 4: The assigned rider collects the food. READY_FOR_PICKUP → PICKED_UP.
   * Hard gate (§3.3 / §4.3): requires the food to be READY_FOR_PICKUP *and* an ACCEPTED assignment
   * belonging to the acting rider. Delivery sub-state ASSIGNED → PICKED_UP. Raises PickupConfirmed.
   */
  public confirmPickup(riderId: string): Result<void> {
    const riderCheck = this.requireAcceptedRider(riderId);
    if (riderCheck.isFailure) return Result.fail<void>(riderCheck.getError());

    const transition = this.props.fulfillmentStatus.transitionTo(FULFILLMENT_STATUS.PICKED_UP);
    if (transition.isFailure) return Result.fail<void>(transition.getError());

    const deliveryTransition = this.props.deliveryStatus.transitionTo(DELIVERY_STATUS.PICKED_UP);
    if (deliveryTransition.isFailure) return Result.fail<void>(deliveryTransition.getError());

    const pickedUpAt = new Date();
    this.props.fulfillmentStatus = transition.getValue();
    this.props.deliveryStatus = deliveryTransition.getValue();
    this.props.pickedUpAt = pickedUpAt;
    this.props.updatedAt = pickedUpAt;
    this.props.version += 1;

    this.addDomainEvent(
      new PickupConfirmed({
        fulfillmentId: this.id.toString(),
        riderId,
        pickedUpAt,
      })
    );

    return Result.ok<void>(undefined);
  }

  /**
   * Phase 4: The rider departs for the customer. PICKED_UP → OUT_FOR_DELIVERY.
   * Delivery sub-state PICKED_UP → EN_ROUTE_TO_CUSTOMER. Raises OutForDelivery.
   */
  public startDelivery(riderId: string): Result<void> {
    const riderCheck = this.requireAcceptedRider(riderId);
    if (riderCheck.isFailure) return Result.fail<void>(riderCheck.getError());

    const transition = this.props.fulfillmentStatus.transitionTo(FULFILLMENT_STATUS.OUT_FOR_DELIVERY);
    if (transition.isFailure) return Result.fail<void>(transition.getError());

    const deliveryTransition = this.props.deliveryStatus.transitionTo(DELIVERY_STATUS.EN_ROUTE_TO_CUSTOMER);
    if (deliveryTransition.isFailure) return Result.fail<void>(deliveryTransition.getError());

    const now = new Date();
    this.props.fulfillmentStatus = transition.getValue();
    this.props.deliveryStatus = deliveryTransition.getValue();
    this.props.updatedAt = now;
    this.props.version += 1;

    this.addDomainEvent(
      new OutForDelivery({
        fulfillmentId: this.id.toString(),
        riderId,
      })
    );

    return Result.ok<void>(undefined);
  }

  /**
   * Phase 4: The rider hands the order to the customer. OUT_FOR_DELIVERY → DELIVERED (terminal).
   * Delivery sub-state EN_ROUTE_TO_CUSTOMER → DELIVERED. Raises DeliveryCompleted.
   */
  public completeDelivery(riderId: string): Result<void> {
    const riderCheck = this.requireAcceptedRider(riderId);
    if (riderCheck.isFailure) return Result.fail<void>(riderCheck.getError());

    const transition = this.props.fulfillmentStatus.transitionTo(FULFILLMENT_STATUS.DELIVERED);
    if (transition.isFailure) return Result.fail<void>(transition.getError());

    const deliveryTransition = this.props.deliveryStatus.transitionTo(DELIVERY_STATUS.DELIVERED);
    if (deliveryTransition.isFailure) return Result.fail<void>(deliveryTransition.getError());

    const deliveredAt = new Date();
    this.props.fulfillmentStatus = transition.getValue();
    this.props.deliveryStatus = deliveryTransition.getValue();
    this.props.deliveredAt = deliveredAt;
    this.props.updatedAt = deliveredAt;
    this.props.version += 1;

    this.addDomainEvent(
      new DeliveryCompleted({
        fulfillmentId: this.id.toString(),
        riderId,
        deliveredAt,
      })
    );

    return Result.ok<void>(undefined);
  }

  /** Guard for rider-driven delivery transitions: an ACCEPTED assignment owned by the acting rider. */
  private requireAcceptedRider(riderId: string): Result<RiderAssignment> {
    const assignment = this.props.currentAssignment;
    if (!assignment || assignment.status.value !== RIDER_ASSIGNMENT_STATUS.ACCEPTED) {
      return Result.fail<RiderAssignment>(
        new ValidationError('This action requires an accepted rider assignment')
      );
    }
    if (assignment.riderId !== riderId) {
      return Result.fail<RiderAssignment>(new ForbiddenError('Only the assigned rider can perform this action'));
    }
    return Result.ok<RiderAssignment>(assignment);
  }

  /**
   * Phase 3A: The offered rider rejects. OFFERED → REJECTED, moved to history; the active slot frees
   * up for a re-offer. No domain event (re-offer is driven by the application/job layer).
   */
  public rejectByRider(riderId: string): Result<void> {
    const assignment = this.props.currentAssignment;
    if (!assignment || assignment.status.value !== RIDER_ASSIGNMENT_STATUS.OFFERED) {
      return Result.fail<void>(new ValidationError('No active offer to reject for this fulfillment'));
    }

    if (assignment.riderId !== riderId) {
      return Result.fail<void>(new ForbiddenError('Only the offered rider can reject this delivery'));
    }

    const rejected = assignment.reject(new Date());
    if (rejected.isFailure) return Result.fail<void>(rejected.getError());

    this.props.assignmentHistory.push(assignment);
    this.props.currentAssignment = null;
    this.props.updatedAt = new Date();
    this.props.version += 1;

    return Result.ok<void>(undefined);
  }

  /**
   * Phase 5A: Cancel the fulfillment. Allowed only from CREATED / PREPARING / READY_FOR_PICKUP
   * (the master state machine permits → CANCELLED only from those states; any later state is
   * rejected with Result.fail). CANCELLED is terminal. Raises FulfillmentCancelled.
   *
   * Ownership: a CUSTOMER actor must be the owning customer; a RESTAURANT actor must be the owning
   * restaurant; SYSTEM (admin) bypasses the ownership check. Rider cancellation is NOT a fulfillment
   * cancellation (§3.2) and is rejected here.
   */
  public cancel(cancelledBy: CancelledByValue, reason: string, actorId?: string): Result<void> {
    if (cancelledBy === CANCELLED_BY.RIDER) {
      return Result.fail<void>(
        new ValidationError('A rider drop is a reassignment, not a fulfillment cancellation')
      );
    }

    if (cancelledBy === CANCELLED_BY.CUSTOMER && actorId !== this.props.customerId) {
      return Result.fail<void>(new ForbiddenError('Only the owning customer can cancel this fulfillment'));
    }

    if (cancelledBy === CANCELLED_BY.RESTAURANT && actorId !== this.props.restaurantId) {
      return Result.fail<void>(new ForbiddenError('Only the owning restaurant can cancel this fulfillment'));
    }

    const transition = this.props.fulfillmentStatus.transitionTo(FULFILLMENT_STATUS.CANCELLED);
    if (transition.isFailure) return Result.fail<void>(transition.getError());

    const now = new Date();
    const cancellationResult = CancellationInfo.create({ cancelledBy, reason, at: now });
    if (cancellationResult.isFailure) return Result.fail<void>(cancellationResult.getError());

    this.props.fulfillmentStatus = transition.getValue();
    this.props.cancellation = cancellationResult.getValue();
    this.props.updatedAt = now;
    this.props.version += 1;

    this.addDomainEvent(
      new FulfillmentCancelled({
        fulfillmentId: this.id.toString(),
        cancelledBy,
        reason: cancellationResult.getValue().reason,
        refundHint: {
          total: {
            amount: this.props.pricingTotal.amount,
            currency: this.props.pricingTotal.currency,
          },
        },
      })
    );

    return Result.ok<void>(undefined);
  }

  /**
   * Phase 5B: the rider could not complete the delivery (customer unavailable, bad address, …).
   * PICKED_UP / OUT_FOR_DELIVERY → FAILED (terminal). Delivery sub-state → FAILED. Raises DeliveryFailed.
   *
   * Allowed only after pickup (the master state machine permits → FAILED only from PICKED_UP /
   * OUT_FOR_DELIVERY; any earlier state is rejected with Result.fail). Actor: the assigned rider
   * (riderId must match the ACCEPTED assignment) or an admin (no riderId). Resolution is out-of-band;
   * this raises NO refund (deferred to a future Payments context, §0.2).
   */
  public failDelivery(failureReason: FailureReasonValue, riderId?: string): Result<void> {
    if (!Object.values(FAILURE_REASON).includes(failureReason)) {
      return Result.fail<void>(new ValidationError(`Invalid failure reason: ${failureReason}`));
    }

    const assignment = this.props.currentAssignment;
    if (!assignment || assignment.status.value !== RIDER_ASSIGNMENT_STATUS.ACCEPTED) {
      return Result.fail<void>(new ValidationError('A delivery can only fail while a rider is assigned'));
    }
    if (riderId !== undefined && assignment.riderId !== riderId) {
      return Result.fail<void>(new ForbiddenError('Only the assigned rider can fail this delivery'));
    }

    const transition = this.props.fulfillmentStatus.transitionTo(FULFILLMENT_STATUS.FAILED);
    if (transition.isFailure) return Result.fail<void>(transition.getError());

    const deliveryTransition = this.props.deliveryStatus.transitionTo(DELIVERY_STATUS.FAILED);
    if (deliveryTransition.isFailure) return Result.fail<void>(deliveryTransition.getError());

    const now = new Date();
    this.props.fulfillmentStatus = transition.getValue();
    this.props.deliveryStatus = deliveryTransition.getValue();
    this.props.failureReason = failureReason;
    this.props.updatedAt = now;
    this.props.version += 1;

    this.addDomainEvent(
      new DeliveryFailed({
        fulfillmentId: this.id.toString(),
        riderId: assignment.riderId,
        failureReason,
      })
    );

    return Result.ok<void>(undefined);
  }

  /**
   * Phase 5B: hand a pre-pickup delivery from the current ACCEPTED rider to a new rider in one atomic
   * mutation (the folded reassign() + acceptByRider() of §6.1). The dropped attempt moves to history
   * as REASSIGNED; the delivery sub-state cycles ASSIGNED → UNASSIGNED → ASSIGNED; the new rider is
   * recorded as a fresh ACCEPTED attempt. Raises RiderReassigned(previousRiderId, newRiderId, attempt).
   *
   * Guards: the fulfillment must not be terminal; there must be an ACCEPTED current assignment whose
   * delivery is still ASSIGNED (i.e. before pickup — after pickup use failDelivery, §3.2); and the
   * new rider must differ from the dropped one.
   */
  public reassign(newRiderId: string, expiresAt: Date): Result<void> {
    const riderIdCheck = Guard.againstEmptyString(newRiderId, 'NewRiderId');
    if (riderIdCheck.isFailure) return Result.fail<void>(riderIdCheck.getError());

    const assignment = this.props.currentAssignment;
    if (!assignment || assignment.status.value !== RIDER_ASSIGNMENT_STATUS.ACCEPTED) {
      return Result.fail<void>(new ValidationError('Reassignment requires an accepted rider to hand over from'));
    }
    if (this.props.deliveryStatus.value !== DELIVERY_STATUS.ASSIGNED) {
      return Result.fail<void>(
        new ConflictError('Reassignment is only possible before pickup (delivery must be ASSIGNED)')
      );
    }

    const previousRiderId = assignment.riderId;
    if (previousRiderId === newRiderId) {
      return Result.fail<void>(new ValidationError('Cannot reassign a delivery to the same rider'));
    }

    const now = new Date();

    // Drop the current rider: ACCEPTED → REASSIGNED, swept into history.
    const reassigned = assignment.reassign(now);
    if (reassigned.isFailure) return Result.fail<void>(reassigned.getError());
    this.props.assignmentHistory.push(assignment);
    this.props.currentAssignment = null;

    // Reset the rider leg, then bind the new rider as a fresh ACCEPTED attempt.
    const toUnassigned = this.props.deliveryStatus.transitionTo(DELIVERY_STATUS.UNASSIGNED);
    if (toUnassigned.isFailure) return Result.fail<void>(toUnassigned.getError());
    this.props.deliveryStatus = toUnassigned.getValue();

    const attempt = this.props.assignmentHistory.length + 1;
    const offerResult = RiderAssignment.offer({ riderId: newRiderId, attempt, expiresAt, offeredAt: now });
    if (offerResult.isFailure) return Result.fail<void>(offerResult.getError());
    const newAssignment = offerResult.getValue();

    const accepted = newAssignment.accept(now);
    if (accepted.isFailure) return Result.fail<void>(accepted.getError());

    const toAssigned = this.props.deliveryStatus.transitionTo(DELIVERY_STATUS.ASSIGNED);
    if (toAssigned.isFailure) return Result.fail<void>(toAssigned.getError());
    this.props.deliveryStatus = toAssigned.getValue();

    this.props.currentAssignment = newAssignment;
    this.props.updatedAt = now;
    this.props.version += 1;

    this.addDomainEvent(
      new RiderReassigned({
        fulfillmentId: this.id.toString(),
        previousRiderId,
        newRiderId,
        attempt,
      })
    );

    return Result.ok<void>(undefined);
  }

  /**
   * Phase 5B: expire the live offer whose TTL has lapsed. OFFERED → EXPIRED, swept into history; the
   * active slot frees for a re-offer. Raises RiderAssignmentExpired. Driven by the assignment-timeout
   * job — guarded so a replayed/stale job is a no-op (Result.fail) rather than an illegal transition.
   */
  public expireCurrentOffer(): Result<void> {
    const assignment = this.props.currentAssignment;
    if (!assignment || assignment.status.value !== RIDER_ASSIGNMENT_STATUS.OFFERED) {
      return Result.fail<void>(new ValidationError('No live offer to expire for this fulfillment'));
    }
    if (!assignment.isExpired()) {
      return Result.fail<void>(new ValidationError('Offer has not yet expired'));
    }

    const expired = assignment.expire(new Date());
    if (expired.isFailure) return Result.fail<void>(expired.getError());

    this.props.assignmentHistory.push(assignment);
    this.props.currentAssignment = null;
    this.props.updatedAt = new Date();
    this.props.version += 1;

    this.addDomainEvent(
      new RiderAssignmentExpired({
        fulfillmentId: this.id.toString(),
        riderId: assignment.riderId,
        attempt: assignment.attempt,
      })
    );

    return Result.ok<void>(undefined);
  }

  /** Rehydrate a persisted fulfillment (repository entry point; raises no events). */
  public static reconstitute(props: FulfillmentProps, id: UniqueEntityId): Fulfillment {
    return new Fulfillment(
      {
        ...props,
        lines: [...props.lines],
        assignmentHistory: [...props.assignmentHistory],
      },
      id
    );
  }
}
