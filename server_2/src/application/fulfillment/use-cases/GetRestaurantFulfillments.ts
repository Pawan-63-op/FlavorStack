// UC: GetRestaurantFulfillments — fetch active fulfillments for a restaurant's queue board.
// Phase 2: queries the write-side aggregate repository.
// Phase 6: also available via the RestaurantFulfillmentView projection (used by the projector-backed
//          query path). This implementation retains the aggregate-repo path for backward compatibility
//          with existing tests; the projection-backed path is available via the projection repository.
import { Result } from '../../../domain/shared/Result';
import { IFulfillmentRepository } from '../../../domain/fulfillment/repositories/IFulfillmentRepository';
import { GetRestaurantFulfillmentsDto } from '../dtos/GetRestaurantFulfillmentsDto';
import { FulfillmentResponse, toFulfillmentResponse } from '../responses/FulfillmentResponse';

export class GetRestaurantFulfillments {
  constructor(private readonly fulfillmentRepo: IFulfillmentRepository) {}

  async execute(dto: GetRestaurantFulfillmentsDto): Promise<Result<FulfillmentResponse[]>> {
    const fulfillments = await this.fulfillmentRepo.findActiveByRestaurant(dto.restaurantId, dto.status);
    return Result.ok(fulfillments.map(toFulfillmentResponse));
  }
}
