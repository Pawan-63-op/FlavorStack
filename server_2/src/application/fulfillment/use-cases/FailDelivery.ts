// UC: FailDelivery — the assigned rider (or an admin) marks a delivery unrecoverable
// (fulfillment_module.md §6.1, Phase 5B). The aggregate enforces that failure is only possible after
// pickup and (for the rider path) that the actor owns the ACCEPTED assignment; emits DeliveryFailed
// and reaches the terminal FAILED state. Idempotent on replay: a second call on a terminal
// fulfillment fails the FulfillmentStatus transition and is a no-op (Result.fail, nothing persisted).
// NO refund is raised here — refund execution is deferred to a future Payments context (§0.2).
import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { IFulfillmentRepository } from '../../../domain/fulfillment/repositories/IFulfillmentRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { FailDeliveryDto } from '../dtos/FailDeliveryDto';
import { FulfillmentResponse, toFulfillmentResponse } from '../responses/FulfillmentResponse';

export class FailDelivery {
  constructor(
    private readonly fulfillmentRepo: IFulfillmentRepository,
    private readonly unitOfWork: IUnitOfWork,
    private readonly outboxStore: IOutboxStore,
    private readonly eventBus: IEventBus
  ) {}

  async execute(dto: FailDeliveryDto): Promise<Result<FulfillmentResponse>> {
    const fulfillment = await this.fulfillmentRepo.findById(dto.fulfillmentId);
    if (!fulfillment) return Result.fail(new NotFoundError('fulfillment_not_found'));

    const result = fulfillment.failDelivery(dto.failureReason, dto.riderId);
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
