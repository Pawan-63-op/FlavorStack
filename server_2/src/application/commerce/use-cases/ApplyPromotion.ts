import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ICartRepository } from '../../../domain/commerce/repositories/ICartRepository';
import { IPromotionService } from '../../../domain/commerce/services/IPromotionService';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { ApplyPromotionDto } from '../dtos/ApplyPromotionDto';
import { CartResponseDto, toCartResponse } from '../dtos/CartResponseDto';

export class ApplyPromotion {
  constructor(
    private readonly cartRepo: ICartRepository,
    private readonly promotionService: IPromotionService,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async execute(dto: ApplyPromotionDto): Promise<Result<CartResponseDto>> {
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

    const applyResult = cart.applyPromotion(promotionResult.getValue());
    if (applyResult.isFailure) return Result.fail(applyResult.getError());

    await this.unitOfWork.runInTransaction(async () => {
      await this.cartRepo.save(cart);
    });

    return Result.ok(toCartResponse(cart));
  }
}
