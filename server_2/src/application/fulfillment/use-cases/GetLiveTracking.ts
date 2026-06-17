// UC: GetLiveTracking — returns the CustomerTrackingView with timeline for a specific order
// (fulfillment_module.md §6.2 / §7.3, Phase 6). No transaction; reads from the projection.
import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import {
  IFulfillmentProjectionRepository,
  CustomerTrackingView,
} from '../../../domain/fulfillment/repositories/IFulfillmentProjectionRepository';
import { IFulfillmentReadCache } from '../../../domain/fulfillment/services/IFulfillmentCache';
import { GetLiveTrackingDto } from '../dtos/GetLiveTrackingDto';
import { TrackingResponse, toTrackingResponse } from '../responses/TrackingResponse';

export class GetLiveTracking {
  constructor(
    private readonly projectionRepo: IFulfillmentProjectionRepository,
    private readonly cache?: IFulfillmentReadCache
  ) {}

  async execute(dto: GetLiveTrackingDto): Promise<Result<TrackingResponse>> {
    // Cache-aside the raw view (ownership/not-found checks run on the cached result, so a denied
    // request never poisons the cache). When no cache is wired we read the projection directly.
    const loadView = (): Promise<CustomerTrackingView | null> =>
      this.projectionRepo.findCustomerTracking(dto.fulfillmentId);
    const view = this.cache
      ? await this.cache.rememberTracking(dto.fulfillmentId, loadView)
      : await loadView();
    if (!view) {
      return Result.fail(new NotFoundError('Fulfillment not found', { fulfillmentId: dto.fulfillmentId }));
    }
    // Ownership check: if a customerId is supplied the view must belong to that customer.
    if (dto.customerId && view.customerId !== dto.customerId) {
      return Result.fail(new ForbiddenError('Access denied'));
    }
    return Result.ok(toTrackingResponse(view));
  }
}
