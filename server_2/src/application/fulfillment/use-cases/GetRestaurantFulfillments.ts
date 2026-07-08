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
