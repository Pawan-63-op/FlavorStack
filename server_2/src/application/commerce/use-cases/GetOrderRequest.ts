// UC: GetOrderRequest — loads an immutable OrderRequest by id for history/confirmation
// screens (Phase 13, commerce_module.md §7/§9). Enforces ownership: a customer may only
// read their own order requests (ForbiddenError otherwise), matching the cart/checkout
// authorization rule. No projection or ACL read — the OrderRequest is self-contained.
import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import { IOrderRequestRepository } from '../../../domain/commerce/repositories/IOrderRequestRepository';
import { GetOrderRequestDto } from '../dtos/GetOrderRequestDto';
import {
  OrderRequestSummaryResponse,
  toOrderRequestSummaryResponse,
} from '../responses/OrderRequestSummaryResponse';

export class GetOrderRequest {
  constructor(private readonly orderRequestRepo: IOrderRequestRepository) {}

  async execute(dto: GetOrderRequestDto): Promise<Result<OrderRequestSummaryResponse>> {
    const order = await this.orderRequestRepo.findById(dto.orderRequestId);
    if (!order) return Result.fail<OrderRequestSummaryResponse>(new NotFoundError('order_request_not_found'));

    if (order.customerId !== dto.customerId) {
      return Result.fail<OrderRequestSummaryResponse>(new ForbiddenError('order_request_forbidden'));
    }

    return Result.ok<OrderRequestSummaryResponse>(toOrderRequestSummaryResponse(order));
  }
}
