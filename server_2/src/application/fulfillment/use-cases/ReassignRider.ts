// UC: ReassignRider — admin/system hands a delivery to a different rider (fulfillment_module.md
// §6.1 / §7.4, Phase 5B). Backs POST /admin/fulfillments/:id/reassign and the timeout/rider-drop path.
//
// Two shapes, decided from the live assignment:
//   • An ACCEPTED rider is on the delivery (a "drop")  → fulfillment.reassign(newRider) hands over in
//     one atomic mutation, emitting RiderReassigned. The replacement rider is dto.riderId, or the next
//     candidate from IDeliveryAssignmentService (excluding everyone already tried).
//   • No ACCEPTED rider (nobody to hand over from)     → delegate to AssignRider, i.e. make a fresh
//     offer (RiderOffered). This keeps the admin endpoint a single call for both situations.
//
// Sequence — rider cancel → reassign:
//
//   Rider(ACCEPTED)        ReassignRider          Fulfillment(agg)        Outbox/Bus
//        │  drop/admin reassign  │                      │                     │
//        │──────────────────────▶│  findById            │                     │
//        │                       │─────────────────────▶│                     │
//        │                       │  pickNextRider(excl)  │                     │
//        │                       │  reassign(newRider)   │                     │
//        │                       │─────────────────────▶│ prev→REASSIGNED→hist │
//        │                       │                       │ delivery ASSIGNED→  │
//        │                       │                       │   UNASSIGNED→ASSIGNED│
//        │                       │                       │ new rider ACCEPTED   │
//        │                       │   runInTransaction { update + append } ─────▶│ RiderReassigned
//        │                       │   publishAll ───────────────────────────────▶│ (→ read models)
//
// Version guard: the aggregate loads at persistedVersion and the repo update CAS-matches it, so a
// concurrent mutation makes this reassignment fail rather than clobber.
import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ConflictError } from '../../../domain/shared/errors/ConflictError';
import { RIDER_ASSIGNMENT_STATUS } from '../../../domain/fulfillment/enums/rider-assignment-status.enum';
import { IFulfillmentRepository } from '../../../domain/fulfillment/repositories/IFulfillmentRepository';
import { IDeliveryAssignmentService } from '../../../domain/fulfillment/services/IDeliveryAssignmentService';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { ReassignRiderDto } from '../dtos/ReassignRiderDto';
import { FulfillmentResponse, toFulfillmentResponse } from '../responses/FulfillmentResponse';
import { AssignRider } from './AssignRider';
import { triedRiderIds, offerExpiry } from './assignment-helpers';

export class ReassignRider {
  constructor(
    private readonly fulfillmentRepo: IFulfillmentRepository,
    private readonly assignmentService: IDeliveryAssignmentService,
    private readonly unitOfWork: IUnitOfWork,
    private readonly outboxStore: IOutboxStore,
    private readonly eventBus: IEventBus,
    private readonly offerTtlSeconds: number,
    private readonly assignRider: AssignRider
  ) {}

  async execute(dto: ReassignRiderDto): Promise<Result<FulfillmentResponse>> {
    const fulfillment = await this.fulfillmentRepo.findById(dto.fulfillmentId);
    if (!fulfillment) return Result.fail(new NotFoundError('fulfillment_not_found'));

    const current = fulfillment.currentAssignment;
    const hasAcceptedRider = current?.status.value === RIDER_ASSIGNMENT_STATUS.ACCEPTED;

    // No accepted rider to hand over from → a fresh offer is the right action (delegate to AssignRider).
    if (!hasAcceptedRider) {
      return this.assignRider.execute({ fulfillmentId: dto.fulfillmentId, riderId: dto.riderId });
    }

    const newRiderId =
      dto.riderId ??
      (await this.assignmentService.pickNextRider({
        restaurantId: fulfillment.restaurantId,
        address: fulfillment.deliveryAddress,
        excludeRiderIds: triedRiderIds(fulfillment),
      }));
    if (!newRiderId) return Result.fail(new ConflictError('no_available_rider'));

    const result = fulfillment.reassign(newRiderId, offerExpiry(this.offerTtlSeconds));
    if (result.isFailure) return Result.fail(result.getError());

    const events = fulfillment.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.fulfillmentRepo.update(fulfillment);
      if (events.length > 0) await this.outboxStore.append(events, ctx);
    });

    await this.eventBus.publishAll(events);

    return Result.ok(toFulfillmentResponse(fulfillment));
  }
}
