import { Result } from '../../../domain/shared/Result';
import { ICustomerTrackingRepository } from '../../../domain/fulfillment/repositories/ICustomerTrackingRepository';
import { ListCustomerOrdersDto } from '../dtos/ListCustomerOrdersDto';
import { CustomerOrderResponse, toCustomerOrderResponse } from '../responses/CustomerOrderResponse';

export class ListCustomerOrders {
  constructor(private readonly trackingRepo: ICustomerTrackingRepository) {}

  async execute(dto: ListCustomerOrdersDto): Promise<Result<CustomerOrderResponse[]>> {
    const views = await this.trackingRepo.findByCustomer(dto.customerId, {
      limit: dto.limit,
      offset: dto.offset,
    });
    return Result.ok(views.map(toCustomerOrderResponse));
  }
}
