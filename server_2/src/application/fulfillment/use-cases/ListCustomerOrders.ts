import { Result } from '../../../domain/shared/Result';
import { IFulfillmentProjectionRepository } from '../../../domain/fulfillment/repositories/IFulfillmentProjectionRepository';
import { ListCustomerOrdersDto } from '../dtos/ListCustomerOrdersDto';
import { CustomerOrderResponse, toCustomerOrderResponse } from '../responses/CustomerOrderResponse';

export class ListCustomerOrders {
  constructor(private readonly projectionRepo: IFulfillmentProjectionRepository) {}

  async execute(dto: ListCustomerOrdersDto): Promise<Result<CustomerOrderResponse[]>> {
    const views = await this.projectionRepo.findByCustomer(dto.customerId, {
      limit: dto.limit,
      offset: dto.offset,
    });
    return Result.ok(views.map(toCustomerOrderResponse));
  }
}
