// UC: GetRiderQueue — returns the rider's active delivery queue (offers + accepted deliveries)
// (fulfillment_module.md §6.2 / §7.2, Phase 6). No transaction; reads from the RiderQueueView projection.
import { Result } from '../../../domain/shared/Result';
import { IFulfillmentProjectionRepository } from '../../../domain/fulfillment/repositories/IFulfillmentProjectionRepository';
import { GetRiderQueueDto } from '../dtos/GetRiderQueueDto';
import { RiderQueueItemResponse, toRiderQueueItemResponse } from '../responses/RiderQueueResponse';

export class GetRiderQueue {
  constructor(private readonly projectionRepo: IFulfillmentProjectionRepository) {}

  async execute(dto: GetRiderQueueDto): Promise<Result<RiderQueueItemResponse[]>> {
    const items = await this.projectionRepo.findRiderQueue(dto.riderId);
    return Result.ok(items.map(toRiderQueueItemResponse));
  }
}
