// UC: RejectDelivery — the offered rider declines (fulfillment_module.md §6.1, Phase 3B).
// The aggregate moves the rejected attempt to history and frees the active slot (no domain event).
// We then trigger a re-offer to the next candidate via OfferRiderAssignment, in a SEPARATE
// transaction (each command mutates one aggregate version) — best-effort: if no rider is available
// the reject still succeeds and the fulfillment simply waits (the Phase 8 retry job will re-try).
import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { IFulfillmentRepository } from '../../../domain/fulfillment/repositories/IFulfillmentRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { RejectDeliveryDto } from '../dtos/RejectDeliveryDto';
import { FulfillmentResponse, toFulfillmentResponse } from '../responses/FulfillmentResponse';
import { OfferRiderAssignment } from './OfferRiderAssignment';
import { logger } from '../../../infrastructure/observability/logger';

export class RejectDelivery {
  constructor(
    private readonly fulfillmentRepo: IFulfillmentRepository,
    private readonly unitOfWork: IUnitOfWork,
    private readonly outboxStore: IOutboxStore,
    private readonly eventBus: IEventBus,
    private readonly offerRiderAssignment: OfferRiderAssignment
  ) {}

  async execute(dto: RejectDeliveryDto): Promise<Result<FulfillmentResponse>> {
    const fulfillment = await this.fulfillmentRepo.findById(dto.fulfillmentId);
    if (!fulfillment) return Result.fail(new NotFoundError('fulfillment_not_found'));

    const result = fulfillment.rejectByRider(dto.riderId);
    if (result.isFailure) return Result.fail(result.getError());

    const events = fulfillment.pullDomainEvents(); // reject raises none, but keep the shape uniform

    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.fulfillmentRepo.update(fulfillment);
      if (events.length > 0) await this.outboxStore.append(events, ctx);
    });

    if (events.length > 0) await this.eventBus.publishAll(events);

    // Re-offer to the next candidate (best-effort; never fails the reject).
    const reoffer = await this.offerRiderAssignment.execute({ fulfillmentId: dto.fulfillmentId });
    if (reoffer.isFailure) {
      logger.info(
        { fulfillmentId: dto.fulfillmentId, reason: String(reoffer.getError()) },
        '[RejectDelivery] no immediate re-offer after rejection'
      );
    }

    return Result.ok(toFulfillmentResponse(fulfillment));
  }
}
