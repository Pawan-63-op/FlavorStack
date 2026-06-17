// UC: HandleAssignmentTimeout — the brain behind the assignment-timeout job (fulfillment_module.md
// §10, Phase 5B). Driven by a BullMQ delayed job fired at the offer's expiresAt.
//
// Sequence — offer → expire → reoffer (and exhaust → auto-cancel):
//
//   Job(fire@expiresAt)     HandleAssignmentTimeout      Fulfillment(agg)
//        │  {fulfillmentId, attempt}  │                       │
//        │───────────────────────────▶│ findById              │
//        │                            │──────────────────────▶│
//        │   guards (idempotent no-op if any fail):           │
//        │     terminal? / no live offer? / attempt mismatch? / not yet expired?
//        │                            │ expireCurrentOffer()   │ OFFERED→EXPIRED→history
//        │                            │   tx{update+append} ──▶│ RiderAssignmentExpired
//        │   attempts exhausted? ┌────┴────┐                   │
//        │            yes        │         │  no               │
//        │   CancelFulfillment(SYSTEM)   OfferRiderAssignment  │  ← re-offer next candidate
//        │   → FulfillmentCancelled       → RiderOffered (arms a new assignment-timeout job)
//
// Idempotency/version guards: every branch re-reads aggregate state; a replayed or stale job whose
// attempt no longer matches the live OFFERED assignment (already accepted/rejected/superseded) exits
// as a successful no-op. Each mutation is its own transaction (matching RejectDelivery's pattern).
import { Result } from '../../../domain/shared/Result';
import { RIDER_ASSIGNMENT_STATUS } from '../../../domain/fulfillment/enums/rider-assignment-status.enum';
import { CANCELLED_BY } from '../../../domain/fulfillment/enums/cancelled-by.enum';
import { IFulfillmentRepository } from '../../../domain/fulfillment/repositories/IFulfillmentRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { OfferRiderAssignment } from './OfferRiderAssignment';
import { CancelFulfillment } from './CancelFulfillment';
import { logger } from '../../../infrastructure/observability/logger';

export interface HandleAssignmentTimeoutDto {
  fulfillmentId: string;
  attempt: number;
}

export class HandleAssignmentTimeout {
  constructor(
    private readonly fulfillmentRepo: IFulfillmentRepository,
    private readonly unitOfWork: IUnitOfWork,
    private readonly outboxStore: IOutboxStore,
    private readonly eventBus: IEventBus,
    private readonly offerRiderAssignment: OfferRiderAssignment,
    private readonly cancelFulfillment: CancelFulfillment,
    private readonly maxAssignmentAttempts: number
  ) {}

  async execute(dto: HandleAssignmentTimeoutDto): Promise<Result<void>> {
    const fulfillment = await this.fulfillmentRepo.findById(dto.fulfillmentId);
    // Job for a fulfillment that no longer exists, or already in a terminal state → nothing to do.
    if (!fulfillment || fulfillment.fulfillmentStatus.isTerminal()) return Result.ok<void>(undefined);

    const current = fulfillment.currentAssignment;
    // The offer was already accepted/rejected/superseded, or this is a stale attempt → idempotent no-op.
    if (
      !current ||
      current.status.value !== RIDER_ASSIGNMENT_STATUS.OFFERED ||
      current.attempt !== dto.attempt ||
      !current.isExpired()
    ) {
      return Result.ok<void>(undefined);
    }

    const expired = fulfillment.expireCurrentOffer();
    if (expired.isFailure) return Result.ok<void>(undefined); // lost a race; let the live state win

    const events = fulfillment.pullDomainEvents();
    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.fulfillmentRepo.update(fulfillment);
      if (events.length > 0) await this.outboxStore.append(events, ctx);
    });
    await this.eventBus.publishAll(events);

    // Exhausted all configured attempts → auto-cancel (SYSTEM). Otherwise re-offer the next candidate.
    if (fulfillment.assignmentHistory.length >= this.maxAssignmentAttempts) {
      const cancelled = await this.cancelFulfillment.execute({
        fulfillmentId: dto.fulfillmentId,
        cancelledBy: CANCELLED_BY.SYSTEM,
        reason: 'assignment_attempts_exhausted',
      });
      if (cancelled.isFailure) {
        logger.warn(
          { fulfillmentId: dto.fulfillmentId, reason: String(cancelled.getError()) },
          '[HandleAssignmentTimeout] auto-cancel after exhausting attempts failed'
        );
      }
      return Result.ok<void>(undefined);
    }

    const reoffer = await this.offerRiderAssignment.execute({ fulfillmentId: dto.fulfillmentId });
    if (reoffer.isFailure) {
      logger.info(
        { fulfillmentId: dto.fulfillmentId, reason: String(reoffer.getError()) },
        '[HandleAssignmentTimeout] no rider available to re-offer after expiry'
      );
    }
    return Result.ok<void>(undefined);
  }
}
