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
