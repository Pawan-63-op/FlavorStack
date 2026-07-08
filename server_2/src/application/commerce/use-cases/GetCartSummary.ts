import { Result } from '../../../domain/shared/Result';
import { ICartRepository } from '../../../domain/commerce/repositories/ICartRepository';
import { GetCartSummaryDto } from '../dtos/GetCartSummaryDto';
import {
  CartSummaryResponse,
  emptyCartSummary,
  toCartSummaryResponse,
} from '../responses/CartSummaryResponse';

export class GetCartSummary {
  constructor(private readonly cartRepo: ICartRepository) {}

  async execute(dto: GetCartSummaryDto): Promise<Result<CartSummaryResponse>> {
    const cart = await this.cartRepo.findByCustomerId(dto.customerId);
    if (!cart) return Result.ok(emptyCartSummary());

    return Result.ok(toCartSummaryResponse(cart));
  }
}
