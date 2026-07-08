import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ICartRepository } from '../../../domain/commerce/repositories/ICartRepository';
import { IPromotionService } from '../../../domain/commerce/services/IPromotionService';
import { ApplyPromotionDto } from '../dtos/ApplyPromotionDto';
import { ValidatePromotionResponseDto, toValidatePromotionResponse } from '../dtos/PromotionResponseDto';

export class ValidatePromotion {
  constructor(
    private readonly cartRepo: ICartRepository,
    private readonly promotionService: IPromotionService
  ) {}

  async execute(dto: ApplyPromotionDto): Promise<Result<ValidatePromotionResponseDto>> {
    const cart = await this.cartRepo.findByCustomerId(dto.customerId);
    if (!cart) return Result.fail(new NotFoundError('cart_not_found'));

    const subtotalResult = cart.calculateSubtotal();
    if (subtotalResult.isFailure) return Result.fail(subtotalResult.getError());
    const subtotal = subtotalResult.getValue();

    const promotionResult = this.promotionService.validate(dto.code, {
      subtotal,
      currency: subtotal.currency,
    });
    if (promotionResult.isFailure) return Result.fail(promotionResult.getError());

    return Result.ok(toValidatePromotionResponse(promotionResult.getValue()));
  }
}
