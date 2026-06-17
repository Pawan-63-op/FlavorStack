// UC: CancelFulfillment — customer / restaurant / admin cancels a fulfillment (fulfillment_module.md
// §6.1, Phase 5A). The aggregate enforces the cancellation window (CREATED / PREPARING /
// READY_FOR_PICKUP only), ownership per actor, and that CANCELLED is terminal; emits
// FulfillmentCancelled. Refund execution is deferred (the event carries only a refundHint).
import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { IFulfillmentRepository } from '../../../domain/fulfillment/repositories/IFulfillmentRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { CancelFulfillmentDto } from '../dtos/CancelFulfillmentDto';
import { FulfillmentResponse, toFulfillmentResponse } from '../responses/FulfillmentResponse';

export class CancelFulfillment {
  constructor(
    private readonly fulfillmentRepo: IFulfillmentRepository,
    private readonly unitOfWork: IUnitOfWork,
    private readonly outboxStore: IOutboxStore,
    private readonly eventBus: IEventBus
  ) {}

  async execute(dto: CancelFulfillmentDto): Promise<Result<FulfillmentResponse>> {
    const fulfillment = await this.fulfillmentRepo.findById(dto.fulfillmentId);
    if (!fulfillment) return Result.fail(new NotFoundError('fulfillment_not_found'));

    const result = fulfillment.cancel(dto.cancelledBy, dto.reason, dto.actorId);
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
