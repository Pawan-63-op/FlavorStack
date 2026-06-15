import { Result } from '../../../domain/shared/Result';
import { ICartRepository } from '../../../domain/commerce/repositories/ICartRepository';
import { GetCartSummaryDto } from '../dtos/GetCartSummaryDto';
import {
  CartSummaryResponse,
  emptyCartSummary,
  toCartSummaryResponse,
} from '../responses/CartSummaryResponse';

// UC: GetCartSummary — lightweight count + subtotal for the header/badge (Phase 13).
// Unlike GetCart, an absent active cart is not an error: it returns an empty summary
// so the badge can be rendered unconditionally. No catalog projection read is needed.
export class GetCartSummary {
  constructor(private readonly cartRepo: ICartRepository) {}

  async execute(dto: GetCartSummaryDto): Promise<Result<CartSummaryResponse>> {
    const cart = await this.cartRepo.findByCustomerId(dto.customerId);
    if (!cart) return Result.ok(emptyCartSummary());

    return Result.ok(toCartSummaryResponse(cart));
  }
}
