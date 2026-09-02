import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { IFulfillmentRepository } from '../../../domain/fulfillment/repositories/IFulfillmentRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IEventBus } from '../../shared/events/IEventBus';
import { RejectDeliveryDto } from '../dtos/RejectDeliveryDto';
import { FulfillmentResponse, toFulfillmentResponse } from '../responses/FulfillmentResponse';
import { OfferRiderAssignment } from './OfferRiderAssignment';
import { logger } from '../../../infrastructure/observability/logger';

export class RejectDelivery {
  constructor(
    private readonly fulfillmentRepo: IFulfillmentRepository,
    private readonly unitOfWork: IUnitOfWork,
    private readonly eventBus: IEventBus,
    private readonly offerRiderAssignment: OfferRiderAssignment
  ) {}

  async execute(dto: RejectDeliveryDto): Promise<Result<FulfillmentResponse>> {
    const fulfillment = await this.fulfillmentRepo.findById(dto.fulfillmentId);
    if (!fulfillment) return Result.fail(new NotFoundError('fulfillment_not_found'));

    const result = fulfillment.rejectByRider(dto.riderId);
    if (result.isFailure) return Result.fail(result.getError());

    const events = fulfillment.pullDomainEvents(); // reject raises none, but keep the shape uniform

    await this.unitOfWork.runInTransaction(async () => {
      await this.fulfillmentRepo.update(fulfillment);
    });

    if (events.length > 0) await this.eventBus.publishAll(events);

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
