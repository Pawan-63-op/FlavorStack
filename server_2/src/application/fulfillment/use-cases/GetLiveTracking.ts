import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import {
  ICustomerTrackingRepository,
  CustomerTrackingView,
} from '../../../domain/fulfillment/repositories/ICustomerTrackingRepository';
import { IFulfillmentReadCache } from '../../../domain/fulfillment/services/IFulfillmentCache';
import { GetLiveTrackingDto } from '../dtos/GetLiveTrackingDto';
import { TrackingResponse, toTrackingResponse } from '../responses/TrackingResponse';

export class GetLiveTracking {
  constructor(
    private readonly trackingRepo: ICustomerTrackingRepository,
    private readonly cache?: IFulfillmentReadCache
  ) {}

  async execute(dto: GetLiveTrackingDto): Promise<Result<TrackingResponse>> {
    const loadView = (): Promise<CustomerTrackingView | null> =>
      this.trackingRepo.findCustomerTracking(dto.fulfillmentId);
    const view = this.cache
      ? await this.cache.rememberTracking(dto.fulfillmentId, loadView)
      : await loadView();
    if (!view) {
      return Result.fail(new NotFoundError('Fulfillment not found', { fulfillmentId: dto.fulfillmentId }));
    }
    if (dto.customerId && view.customerId !== dto.customerId) {
      return Result.fail(new ForbiddenError('Access denied'));
    }
    return Result.ok(toTrackingResponse(view));
  }
}
