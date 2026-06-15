import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ICartRepository } from '../../../domain/commerce/repositories/ICartRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { RemoveFromCartDto } from '../dtos/RemoveFromCartDto';
import { CartResponseDto, toCartResponse } from '../dtos/CartResponseDto';

// UC: RemoveFromCart — removes a line item from the customer's Cart. Resets
// restaurantId/currency when the cart becomes empty (enforced by Cart.removeItem).
export class RemoveFromCart {
  constructor(
    private readonly cartRepo: ICartRepository,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async execute(dto: RemoveFromCartDto): Promise<Result<CartResponseDto>> {
    const cart = await this.cartRepo.findByCustomerId(dto.customerId);
    if (!cart) return Result.fail(new NotFoundError('cart_not_found'));

    const removeResult = cart.removeItem(dto.cartItemId);
    if (removeResult.isFailure) return Result.fail(removeResult.getError());

    await this.unitOfWork.runInTransaction(async () => {
      await this.cartRepo.save(cart);
    });

    return Result.ok(toCartResponse(cart));
  }
}
