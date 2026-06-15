import { Result } from '../../../domain/shared/Result';
import { Cart } from '../../../domain/commerce/entities/Cart';
import { ICartRepository } from '../../../domain/commerce/repositories/ICartRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { CreateCartDto } from '../dtos/CreateCartDto';
import { CartResponseDto, toCartResponse } from '../dtos/CartResponseDto';

// UC: CreateCart — creates an empty Cart for customerId (no restaurant bound yet).
// Idempotent: a customer already has an active cart -> returns it unchanged
// (one active cart per customer, enforced by ICartRepository). Typically invoked
// implicitly by AddToCart when the customer has no active cart.
export class CreateCart {
  constructor(
    private readonly cartRepo: ICartRepository,
    private readonly unitOfWork: IUnitOfWork
  ) {}

  async execute(dto: CreateCartDto): Promise<Result<CartResponseDto>> {
    const existing = await this.cartRepo.findByCustomerId(dto.customerId);
    if (existing) return Result.ok(toCartResponse(existing));

    const cartResult = Cart.create(dto.customerId);
    if (cartResult.isFailure) return Result.fail(cartResult.getError());

    const cart = cartResult.getValue();

    await this.unitOfWork.runInTransaction(async () => {
      await this.cartRepo.save(cart);
    });

    return Result.ok(toCartResponse(cart));
  }
}
