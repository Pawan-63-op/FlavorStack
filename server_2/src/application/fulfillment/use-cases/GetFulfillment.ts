import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { IFulfillmentProjectionRepository } from '../../../domain/fulfillment/repositories/IFulfillmentProjectionRepository';
import { GetFulfillmentDto } from '../dtos/GetFulfillmentDto';
import { TrackingResponse, toTrackingResponse } from '../responses/TrackingResponse';

export class GetFulfillment {
  constructor(private readonly projectionRepo: IFulfillmentProjectionRepository) {}

  async execute(dto: GetFulfillmentDto): Promise<Result<TrackingResponse>> {
    const view = await this.projectionRepo.findCustomerTracking(dto.fulfillmentId);
    if (!view) {
      return Result.fail(new NotFoundError('Fulfillment not found', { fulfillmentId: dto.fulfillmentId }));
    }
    return Result.ok(toTrackingResponse(view));
  }
}
