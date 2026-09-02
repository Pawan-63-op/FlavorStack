import { Result } from '../../../domain/shared/Result';
import { IFulfillmentQueryRepository } from '../../../domain/fulfillment/repositories/IFulfillmentQueryRepository';
import { GetRiderDeliveryHistoryDto } from '../dtos/GetRiderDeliveryHistoryDto';
import {
  RiderDeliveryHistoryResponse,
  toRiderDeliveryHistoryResponse,
} from '../responses/RiderDeliveryHistoryResponse';

export class GetRiderDeliveryHistory {
  constructor(private readonly queryRepo: IFulfillmentQueryRepository) {}

  async execute(dto: GetRiderDeliveryHistoryDto): Promise<Result<RiderDeliveryHistoryResponse>> {
    const views = await this.queryRepo.findRiderCompletedDeliveries(dto.riderId, {
      limit: dto.limit,
      offset: dto.offset,
    });
    return Result.ok(toRiderDeliveryHistoryResponse(views));
  }
}
