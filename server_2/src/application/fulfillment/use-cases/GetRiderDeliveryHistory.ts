import { Result } from '../../../domain/shared/Result';
import { IFulfillmentProjectionRepository } from '../../../domain/fulfillment/repositories/IFulfillmentProjectionRepository';
import { GetRiderDeliveryHistoryDto } from '../dtos/GetRiderDeliveryHistoryDto';
import {
  RiderDeliveryHistoryResponse,
  toRiderDeliveryHistoryResponse,
} from '../responses/RiderDeliveryHistoryResponse';

export class GetRiderDeliveryHistory {
  constructor(private readonly projectionRepo: IFulfillmentProjectionRepository) {}

  async execute(dto: GetRiderDeliveryHistoryDto): Promise<Result<RiderDeliveryHistoryResponse>> {
    const views = await this.projectionRepo.findRiderCompletedDeliveries(dto.riderId, {
      limit: dto.limit,
      offset: dto.offset,
    });
    return Result.ok(toRiderDeliveryHistoryResponse(views));
  }
}
