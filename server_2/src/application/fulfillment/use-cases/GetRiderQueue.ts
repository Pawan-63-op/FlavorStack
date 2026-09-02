import { Result } from '../../../domain/shared/Result';
import { IFulfillmentQueryRepository } from '../../../domain/fulfillment/repositories/IFulfillmentQueryRepository';
import { GetRiderQueueDto } from '../dtos/GetRiderQueueDto';
import { RiderQueueItemResponse, toRiderQueueItemResponse } from '../responses/RiderQueueResponse';

export class GetRiderQueue {
  constructor(private readonly queryRepo: IFulfillmentQueryRepository) {}

  async execute(dto: GetRiderQueueDto): Promise<Result<RiderQueueItemResponse[]>> {
    const items = await this.queryRepo.findRiderQueue(dto.riderId);
    return Result.ok(items.map(toRiderQueueItemResponse));
  }
}
