import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { Quantity } from '../../../domain/commerce/value-objects/Quantity';
import { ICartRepository } from '../../../domain/commerce/repositories/ICartRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { UpdateCartItemDto } from '../dtos/UpdateCartItemDto';
import { CartResponseDto, toCartResponse } from '../dtos/CartResponseDto';

// UC: UpdateCartItem — changes the quantity of a line item. A quantity of 0
// removes the line item entirely (mirrors typical cart-widget UX where the
// stepper decrements to zero and the row disappears).
export class UpdateCartItem {
  constructor(
    private readonly cartRepo: ICartRepository,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async execute(dto: UpdateCartItemDto): Promise<Result<CartResponseDto>> {
    const cart = await this.cartRepo.findByCustomerId(dto.customerId);
    if (!cart) return Result.fail(new NotFoundError('cart_not_found'));

    if (dto.quantity === 0) {
      const removeResult = cart.removeItem(dto.cartItemId);
      if (removeResult.isFailure) return Result.fail(removeResult.getError());
    } else {
      const quantityResult = Quantity.create(dto.quantity);
      if (quantityResult.isFailure) return Result.fail(quantityResult.getError());

      const updateResult = cart.updateQuantity(dto.cartItemId, quantityResult.getValue());
      if (updateResult.isFailure) return Result.fail(updateResult.getError());
    }

    await this.unitOfWork.runInTransaction(async () => {
      await this.cartRepo.save(cart);
    });

    return Result.ok(toCartResponse(cart));
  }
}
