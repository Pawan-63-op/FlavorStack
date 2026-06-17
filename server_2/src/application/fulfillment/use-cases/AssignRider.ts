// UC: AssignRider — admin manual (re)assignment (fulfillment_module.md §6.1 / §7.4, Phase 3B).
// Backs POST /admin/fulfillments/:id/reassign. When the admin names a riderId we offer to exactly
// that rider; otherwise we fall back to IDeliveryAssignmentService for the next candidate. Emits
// RiderOffered. The aggregate's "one active assignment" invariant rejects an offer while one is live,
// so reassignment of an already-offered/accepted delivery requires the prior attempt to be freed first.
import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ConflictError } from '../../../domain/shared/errors/ConflictError';
import { IFulfillmentRepository } from '../../../domain/fulfillment/repositories/IFulfillmentRepository';
import { IDeliveryAssignmentService } from '../../../domain/fulfillment/services/IDeliveryAssignmentService';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { AssignRiderDto } from '../dtos/AssignRiderDto';
import { FulfillmentResponse, toFulfillmentResponse } from '../responses/FulfillmentResponse';
import { triedRiderIds, offerExpiry } from './assignment-helpers';

export class AssignRider {
  constructor(
    private readonly fulfillmentRepo: IFulfillmentRepository,
    private readonly assignmentService: IDeliveryAssignmentService,
    private readonly unitOfWork: IUnitOfWork,
    private readonly outboxStore: IOutboxStore,
    private readonly eventBus: IEventBus,
    private readonly offerTtlSeconds: number
  ) {}

  async execute(dto: AssignRiderDto): Promise<Result<FulfillmentResponse>> {
    const fulfillment = await this.fulfillmentRepo.findById(dto.fulfillmentId);
    if (!fulfillment) return Result.fail(new NotFoundError('fulfillment_not_found'));

    const riderId =
      dto.riderId ??
      (await this.assignmentService.pickNextRider({
        restaurantId: fulfillment.restaurantId,
        address: fulfillment.deliveryAddress,
        excludeRiderIds: triedRiderIds(fulfillment),
      }));
    if (!riderId) return Result.fail(new ConflictError('no_available_rider'));

    const result = fulfillment.offerToRider(riderId, offerExpiry(this.offerTtlSeconds));
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
