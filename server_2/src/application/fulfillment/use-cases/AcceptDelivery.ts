// UC: AcceptDelivery — the offered rider accepts (fulfillment_module.md §6.1, Phase 3B).
// The aggregate enforces accept-only-by-offered-rider and the offer TTL; emits RiderAssigned.
import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { IFulfillmentRepository } from '../../../domain/fulfillment/repositories/IFulfillmentRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { AcceptDeliveryDto } from '../dtos/AcceptDeliveryDto';
import { FulfillmentResponse, toFulfillmentResponse } from '../responses/FulfillmentResponse';

export class AcceptDelivery {
  constructor(
    private readonly fulfillmentRepo: IFulfillmentRepository,
    private readonly unitOfWork: IUnitOfWork,
    private readonly outboxStore: IOutboxStore,
    private readonly eventBus: IEventBus
  ) {}

  async execute(dto: AcceptDeliveryDto): Promise<Result<FulfillmentResponse>> {
    const fulfillment = await this.fulfillmentRepo.findById(dto.fulfillmentId);
    if (!fulfillment) return Result.fail(new NotFoundError('fulfillment_not_found'));

    const result = fulfillment.acceptByRider(dto.riderId);
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
