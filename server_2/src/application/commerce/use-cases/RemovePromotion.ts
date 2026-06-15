import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ICartRepository } from '../../../domain/commerce/repositories/ICartRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { RemovePromotionDto } from '../dtos/ApplyPromotionDto';
import { CartResponseDto, toCartResponse } from '../dtos/CartResponseDto';

// UC: RemovePromotion — clears the Cart's appliedPromotion (Phase 8) and persists.
export class RemovePromotion {
  constructor(
    private readonly cartRepo: ICartRepository,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async execute(dto: RemovePromotionDto): Promise<Result<CartResponseDto>> {
    const cart = await this.cartRepo.findByCustomerId(dto.customerId);
    if (!cart) return Result.fail(new NotFoundError('cart_not_found'));

    const removeResult = cart.removePromotion();
    if (removeResult.isFailure) return Result.fail(removeResult.getError());

    await this.unitOfWork.runInTransaction(async () => {
      await this.cartRepo.save(cart);
    });

    return Result.ok(toCartResponse(cart));
  }
}
